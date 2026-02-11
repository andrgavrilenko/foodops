import { createHash } from 'node:crypto';
import type { PrismaClient } from '@foodops/db';
import type { JwtService } from '../plugins/auth.js';
import type { AppConfig } from '../config.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { AppError, ErrorCodes } from '../lib/errors.js';
import type { FastifyBaseLogger } from '../lib/logger.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createAuthService(prisma: PrismaClient, jwt: JwtService, config: AppConfig) {
  async function generateTokens(userId: string, email: string) {
    const accessToken = jwt.signAccess({ userId, email });
    const refreshToken = jwt.signRefresh({ userId, email });

    // Store refresh token hash in DB
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + config.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  function toAuthResponse(
    user: { id: string; email: string; language: string; createdAt: Date },
    tokens: { accessToken: string; refreshToken: string },
  ) {
    return {
      user: {
        id: user.id,
        email: user.email,
        language: user.language,
        created_at: user.createdAt.toISOString(),
      },
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: config.JWT_ACCESS_EXPIRY_SECONDS,
    };
  }

  return {
    async register(email: string, password: string, language: string, log?: FastifyBaseLogger) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new AppError('Email already registered', 409, ErrorCodes.AUTH_EMAIL_EXISTS);
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: { email, passwordHash, language },
      });

      log?.info({ event: 'user_registered', userId: user.id }, 'User registered');

      const tokens = await generateTokens(user.id, user.email);
      return toAuthResponse(user, tokens);
    },

    async login(email: string, password: string, log?: FastifyBaseLogger) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) {
        log?.warn({ event: 'user_login_failed', reason: 'unknown_email' }, 'Login failed');
        throw new AppError('Invalid email or password', 401, ErrorCodes.AUTH_INVALID_CREDENTIALS);
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        log?.warn({ event: 'user_login_failed', userId: user.id, reason: 'bad_password' }, 'Login failed');
        throw new AppError('Invalid email or password', 401, ErrorCodes.AUTH_INVALID_CREDENTIALS);
      }

      log?.info({ event: 'user_login_success', userId: user.id }, 'User logged in');

      const tokens = await generateTokens(user.id, user.email);
      return toAuthResponse(user, tokens);
    },

    async refresh(refreshToken: string, log?: FastifyBaseLogger) {
      const payload = jwt.verifyRefresh(refreshToken);

      const tokenHash = hashToken(refreshToken);
      const stored = await prisma.refreshToken.findFirst({
        where: { tokenHash, userId: payload.userId },
      });

      if (!stored || stored.expiresAt < new Date()) {
        // Delete all tokens for this user if token reuse detected
        log?.warn({ event: 'token_reuse_detected', userId: payload.userId }, 'Refresh token reuse detected');
        await prisma.refreshToken.deleteMany({ where: { userId: payload.userId } });
        throw new AppError(
          'Invalid or expired refresh token',
          401,
          ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
        );
      }

      // Rotate: delete old + cleanup expired tokens for this user
      await prisma.refreshToken.deleteMany({
        where: {
          userId: payload.userId,
          OR: [{ id: stored.id }, { expiresAt: { lt: new Date() } }],
        },
      });
      const tokens = await generateTokens(payload.userId, payload.email);

      log?.info({ event: 'token_refreshed', userId: payload.userId }, 'Token refreshed');

      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_in: config.JWT_ACCESS_EXPIRY_SECONDS,
      };
    },

    async logout(userId: string, log?: FastifyBaseLogger) {
      await prisma.refreshToken.deleteMany({ where: { userId } });
      log?.info({ event: 'user_logout', userId }, 'User logged out');
    },
  };
}
