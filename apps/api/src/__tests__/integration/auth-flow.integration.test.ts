import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  isDockerAvailable,
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
  getConnectionUri,
} from './setup-db.js';
import type { FastifyInstance } from 'fastify';

const dockerAvailable = await isDockerAvailable();

describe.skipIf(!dockerAvailable)('Integration: Auth flow', () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;

  beforeAll(async () => {
    prisma = await setupTestDatabase();

    // Set env vars for the app
    process.env['DATABASE_URL'] = getConnectionUri();
    process.env['NODE_ENV'] = 'test';
    process.env['LOG_LEVEL'] = 'fatal';
    process.env['JWT_ACCESS_SECRET'] = 'integration-test-access-secret-32-chars-minimum!!';
    process.env['JWT_REFRESH_SECRET'] = 'integration-test-refresh-secret-32-chars-minimum!!';
    process.env['OPENAI_API_KEY'] = 'test-openai-key';
    process.env['OPENAI_MODEL'] = 'gpt-4o-mini';

    // Dynamic import to pick up env vars
    const { buildApp } = await import('../../app.js');
    const { loadConfig } = await import('../../config.js');
    const config = loadConfig();
    app = buildApp(config);
    await app.ready();
  }, 120_000); // Container startup can be slow

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  }, 30_000);

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('should complete register -> login -> refresh -> logout flow', async () => {
    const email = 'test@example.com';
    const password = 'StrongPass1';

    // 1. Register
    const registerRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password },
    });

    expect(registerRes.statusCode).toBe(201);
    const registerBody = registerRes.json();
    expect(registerBody.user.email).toBe(email);
    expect(registerBody.access_token).toBeDefined();
    expect(registerBody.refresh_token).toBeDefined();
    expect(registerBody.expires_in).toBe(300);

    // 2. Login with same credentials
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json();
    expect(loginBody.user.email).toBe(email);
    expect(loginBody.access_token).toBeDefined();
    expect(loginBody.refresh_token).toBeDefined();

    // 3. Refresh token
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: loginBody.refresh_token },
    });

    expect(refreshRes.statusCode).toBe(200);
    const refreshBody = refreshRes.json();
    expect(refreshBody.access_token).toBeDefined();
    expect(refreshBody.refresh_token).toBeDefined();
    // New tokens should differ from old
    expect(refreshBody.access_token).not.toBe(loginBody.access_token);
    expect(refreshBody.refresh_token).not.toBe(loginBody.refresh_token);

    // 4. Logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${refreshBody.access_token}` },
    });

    expect(logoutRes.statusCode).toBe(204);

    // 5. Old refresh token should no longer work
    const staleRefreshRes = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refresh_token: refreshBody.refresh_token },
    });

    expect(staleRefreshRes.statusCode).toBe(401);
  });

  it('should reject duplicate email registration', async () => {
    const email = 'dupe@example.com';

    // Register first time
    const res1 = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'StrongPass1' },
    });
    expect(res1.statusCode).toBe(201);

    // Register second time with same email
    const res2 = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: 'StrongPass2' },
    });
    expect(res2.statusCode).toBe(409);
  });

  it('should reject login with wrong password', async () => {
    // Register
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'wrong@example.com', password: 'StrongPass1' },
    });

    // Login with wrong password
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'wrong@example.com', password: 'WrongPass9' },
    });

    expect(res.statusCode).toBe(401);
  });
});
