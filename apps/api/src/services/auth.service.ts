import { createHash } from 'node:crypto';
import type { PrismaClient } from '@foodops/db';
import type { JwtService } from '../plugins/auth.js';
import type { AppConfig } from '../config.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { AppError, ErrorCodes } from '../lib/errors.js';

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

  return {
    async register(email: string, password: string, language: string) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new AppError('Email already registered', 409, ErrorCodes.AUTH_EMAIL_EXISTS);
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: { email, passwordHash, language },
      });

      const tokens = await generateTokens(user.id, user.email);

      return {
        user: {
          id: user.id,
          email: user.email,
          language: user.language,
          created_at: user.createdAt.toISOString(),
        },
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      };
    },

    async login(email: string, password: string) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) {
        throw new AppError('Invalid email or password', 401, ErrorCodes.AUTH_INVALID_CREDENTIALS);
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        throw new AppError('Invalid email or password', 401, ErrorCodes.AUTH_INVALID_CREDENTIALS);
      }

      const tokens = await generateTokens(user.id, user.email);

      return {
        user: {
          id: user.id,
          email: user.email,
          language: user.language,
          created_at: user.createdAt.toISOString(),
        },
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      };
    },

    async refresh(refreshToken: string) {
      const payload = jwt.verifyRefresh(refreshToken);

      const tokenHash = hashToken(refreshToken);
      const stored = await prisma.refreshToken.findFirst({
        where: { tokenHash, userId: payload.userId },
      });

      if (!stored || stored.expiresAt < new Date()) {
        // Delete all tokens for this user if token reuse detected
        await prisma.refreshToken.deleteMany({ where: { userId: payload.userId } });
        throw new AppError(
          'Invalid or expired refresh token',
          401,
          ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
        );
      }

      // Rotate: delete old, issue new
      await prisma.refreshToken.delete({ where: { id: stored.id } });
      const tokens = await generateTokens(payload.userId, payload.email);

      return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      };
    },

    async logout(userId: string) {
      await prisma.refreshToken.deleteMany({ where: { userId } });
    },
  };
}
