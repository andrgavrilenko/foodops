import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mockPrisma } from './helpers/setup.js';
import { registerUser } from './helpers/auth-helper.js';
import type { FastifyInstance } from 'fastify';

const { buildApp } = await import('../app.js');
const { loadConfig } = await import('../config.js');

describe('Dietary restriction endpoints', () => {
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

  const memberId = '00000000-0000-0000-0000-000000000001';

  describe('POST /family/members/:memberId/dietary-restrictions', () => {
    it('should create a dietary restriction', async () => {
      const { accessToken, userId } = await registerUser(app);
      const now = new Date();

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.familyMember.findFirst.mockResolvedValueOnce({
        id: memberId,
        familyId: 'fam-1',
      });
      mockPrisma.dietaryRestriction.create.mockResolvedValueOnce({
        id: 'dr-1',
        memberId,
        type: 'ALLERGY',
        value: 'peanuts',
        severity: 'STRICT',
        createdAt: now,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/family/members/${memberId}/dietary-restrictions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { type: 'ALLERGY', value: 'peanuts', severity: 'STRICT' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.type).toBe('ALLERGY');
      expect(body.value).toBe('peanuts');
      expect(body.severity).toBe('STRICT');
    });

    it('should return 409 for duplicate restriction', async () => {
      const { accessToken, userId } = await registerUser(app);

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.familyMember.findFirst.mockResolvedValueOnce({
        id: memberId,
        familyId: 'fam-1',
      });

      const prismaError = new Error('Unique constraint') as Error & { code: string };
      prismaError.code = 'P2002';
      mockPrisma.dietaryRestriction.create.mockRejectedValueOnce(prismaError);

      const response = await app.inject({
        method: 'POST',
        url: `/family/members/${memberId}/dietary-restrictions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { type: 'ALLERGY', value: 'peanuts', severity: 'STRICT' },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.error.code).toBe('RESTRICTION_DUPLICATE');
    });

    it('should return 404 if member not found', async () => {
      const { accessToken, userId } = await registerUser(app);

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.familyMember.findFirst.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: `/family/members/${memberId}/dietary-restrictions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { type: 'ALLERGY', value: 'peanuts', severity: 'STRICT' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /family/members/:memberId/dietary-restrictions/:id', () => {
    it('should delete a dietary restriction', async () => {
      const { accessToken, userId } = await registerUser(app);
      const restrictionId = '00000000-0000-0000-0000-000000000002';

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.familyMember.findFirst.mockResolvedValueOnce({
        id: memberId,
        familyId: 'fam-1',
      });
      mockPrisma.dietaryRestriction.findFirst.mockResolvedValueOnce({
        id: restrictionId,
        memberId,
      });
      mockPrisma.dietaryRestriction.delete.mockResolvedValueOnce({ id: restrictionId });

      const response = await app.inject({
        method: 'DELETE',
        url: `/family/members/${memberId}/dietary-restrictions/${restrictionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(204);
    });
  });
});
