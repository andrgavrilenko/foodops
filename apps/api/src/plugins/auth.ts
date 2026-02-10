import fp from 'fastify-plugin';
import { createSigner, createVerifier } from 'fast-jwt';
import { AppError, ErrorCodes } from '../lib/errors.js';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

export interface JwtPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface JwtService {
  signAccess(payload: { userId: string; email: string }): string;
  signRefresh(payload: { userId: string; email: string }): string;
  verifyAccess(token: string): JwtPayload;
  verifyRefresh(token: string): JwtPayload;
}

declare module 'fastify' {
  interface FastifyInstance {
    jwt: JwtService;
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    user: JwtPayload;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const { JWT_SECRET, JWT_ACCESS_EXPIRY_SECONDS, JWT_REFRESH_EXPIRY_DAYS } = fastify.config;

  const accessSigner = createSigner({
    key: JWT_SECRET,
    expiresIn: JWT_ACCESS_EXPIRY_SECONDS * 1000,
  });

  const refreshSigner = createSigner({
    key: JWT_SECRET,
    expiresIn: JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  });

  const verifier = createVerifier({ key: JWT_SECRET });

  const jwtService: JwtService = {
    signAccess(payload) {
      return accessSigner({ userId: payload.userId, email: payload.email, type: 'access' });
    },
    signRefresh(payload) {
      return refreshSigner({ userId: payload.userId, email: payload.email, type: 'refresh' });
    },
    verifyAccess(token) {
      try {
        const decoded = verifier(token) as JwtPayload;
        if (decoded.type !== 'access') {
          throw new AppError('Invalid token type', 401, ErrorCodes.AUTH_INVALID_TOKEN);
        }
        return decoded;
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError('Invalid or expired token', 401, ErrorCodes.AUTH_INVALID_TOKEN);
      }
    },
    verifyRefresh(token) {
      try {
        const decoded = verifier(token) as JwtPayload;
        if (decoded.type !== 'refresh') {
          throw new AppError('Invalid token type', 401, ErrorCodes.AUTH_REFRESH_TOKEN_INVALID);
        }
        return decoded;
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(
          'Invalid or expired refresh token',
          401,
          ErrorCodes.AUTH_REFRESH_TOKEN_INVALID,
        );
      }
    },
  };

  fastify.decorate('jwt', jwtService);

  const authenticate = async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Missing or invalid authorization header', 401, ErrorCodes.UNAUTHORIZED);
    }
    const token = authHeader.slice(7);
    request.user = fastify.jwt.verifyAccess(token);
  };

  fastify.decorate('authenticate', authenticate);

  fastify.log.info('Auth plugin registered');
};

export default fp(authPlugin, {
  name: 'auth',
  dependencies: [],
});
