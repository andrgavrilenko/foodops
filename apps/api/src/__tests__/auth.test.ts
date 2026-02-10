import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mockPrisma } from './helpers/setup.js';
import type { FastifyInstance } from 'fastify';

const { buildApp } = await import('../app.js');
const { loadConfig } = await import('../config.js');

describe('Auth endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const config = loadConfig();
    app = buildApp(config);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const now = new Date();
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@test.com',
        passwordHash: 'hashed',
        authProvider: 'local',
        authProviderId: null,
        language: 'en',
        createdAt: now,
        updatedAt: now,
      });
      mockPrisma.refreshToken.create.mockResolvedValueOnce({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'test@test.com', password: 'Password1' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.user.email).toBe('test@test.com');
      expect(body.user.id).toBe('user-1');
      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();
    });

    it('should return 409 if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'existing@test.com',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'existing@test.com', password: 'Password1' },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.error.code).toBe('AUTH_EMAIL_EXISTS');
    });

    it('should return 400 for weak password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'test@test.com', password: 'weak' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'not-an-email', password: 'Password1' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should return 401 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'noone@test.com', password: 'Password1' },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return 400 for missing refresh_token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refresh_token: 'invalid-token' },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('AUTH_REFRESH_TOKEN_INVALID');
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 204 with valid token', async () => {
      // First register to get a token
      const now = new Date();
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'logout-user',
        email: 'logout@test.com',
        passwordHash: 'hashed',
        authProvider: 'local',
        authProviderId: null,
        language: 'en',
        createdAt: now,
        updatedAt: now,
      });
      mockPrisma.refreshToken.create.mockResolvedValueOnce({
        id: 'rt-logout',
        userId: 'logout-user',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
      });

      const registerRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'logout@test.com', password: 'Password1' },
      });
      const { access_token } = registerRes.json();

      mockPrisma.refreshToken.deleteMany.mockResolvedValueOnce({ count: 1 });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { authorization: `Bearer ${access_token}` },
      });

      expect(response.statusCode).toBe(204);
    });
  });
});
