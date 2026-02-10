import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mockPrisma } from './helpers/setup.js';
import { registerUser } from './helpers/auth-helper.js';
import type { FastifyInstance } from 'fastify';

const { buildApp } = await import('../app.js');
const { loadConfig } = await import('../config.js');

describe('Family member endpoints', () => {
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

  describe('POST /family/members', () => {
    it('should create a family member', async () => {
      const { accessToken, userId } = await registerUser(app);
      const now = new Date();

      // verifyFamilyOwnership
      mockPrisma.family.findUnique.mockResolvedValueOnce({
        id: 'fam-1',
        userId,
      });
      mockPrisma.familyMember.count.mockResolvedValueOnce(2);
      mockPrisma.familyMember.create.mockResolvedValueOnce({
        id: 'mem-1',
        familyId: 'fam-1',
        name: 'Bob',
        age: 5,
        role: 'CHILD',
        createdAt: now,
        updatedAt: now,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/family/members',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Bob', age: 5, role: 'CHILD' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.name).toBe('Bob');
      expect(body.role).toBe('CHILD');
      expect(body.age).toBe(5);
    });

    it('should return 400 if member limit exceeded', async () => {
      const { accessToken, userId } = await registerUser(app);

      mockPrisma.family.findUnique.mockResolvedValueOnce({
        id: 'fam-1',
        userId,
      });
      mockPrisma.familyMember.count.mockResolvedValueOnce(10);

      const response = await app.inject({
        method: 'POST',
        url: '/family/members',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Extra', age: 20, role: 'ADULT' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('FAMILY_MEMBER_LIMIT_EXCEEDED');
    });
  });

  describe('PATCH /family/members/:id', () => {
    it('should update a family member', async () => {
      const { accessToken, userId } = await registerUser(app);
      const now = new Date();

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.familyMember.findFirst.mockResolvedValueOnce({
        id: 'mem-1',
        familyId: 'fam-1',
        name: 'Old Name',
        age: 5,
        role: 'CHILD',
      });
      mockPrisma.familyMember.update.mockResolvedValueOnce({
        id: 'mem-1',
        familyId: 'fam-1',
        name: 'New Name',
        age: 6,
        role: 'CHILD',
        createdAt: now,
        updatedAt: now,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/family/members/00000000-0000-0000-0000-000000000001',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'New Name', age: 6 },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe('New Name');
    });

    it('should return 404 if member not found', async () => {
      const { accessToken, userId } = await registerUser(app);

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.familyMember.findFirst.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/family/members/00000000-0000-0000-0000-000000000099',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Ghost' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /family/members/:id', () => {
    it('should delete a family member', async () => {
      const { accessToken, userId } = await registerUser(app);

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.familyMember.findFirst.mockResolvedValueOnce({
        id: 'mem-1',
        familyId: 'fam-1',
      });
      mockPrisma.familyMember.delete.mockResolvedValueOnce({ id: 'mem-1' });

      const response = await app.inject({
        method: 'DELETE',
        url: '/family/members/00000000-0000-0000-0000-000000000001',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(204);
    });
  });
});
