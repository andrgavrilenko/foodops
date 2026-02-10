import type { FastifyInstance } from 'fastify';
import { mockPrisma } from './setup.js';

let userCounter = 0;

export async function registerUser(app: FastifyInstance, overrides?: { email?: string }) {
  userCounter++;
  const email = overrides?.email ?? `user${userCounter}@test.com`;
  const userId = `user-id-${userCounter}`;

  const now = new Date();

  // Mock user.findUnique to return null (no existing user)
  mockPrisma.user.findUnique.mockResolvedValueOnce(null);

  // Mock user.create
  mockPrisma.user.create.mockResolvedValueOnce({
    id: userId,
    email,
    passwordHash: 'hashed',
    authProvider: 'local',
    authProviderId: null,
    language: 'en',
    createdAt: now,
    updatedAt: now,
  });

  // Mock refreshToken.create
  mockPrisma.refreshToken.create.mockResolvedValueOnce({
    id: 'rt-1',
    userId,
    tokenHash: 'hash',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: now,
  });

  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'Password1' },
  });

  const body = response.json();
  return {
    userId,
    email,
    accessToken: body.access_token as string,
    refreshToken: body.refresh_token as string,
    response,
  };
}
