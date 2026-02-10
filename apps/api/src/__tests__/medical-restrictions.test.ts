import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mockPrisma } from './helpers/setup.js';
import { registerUser } from './helpers/auth-helper.js';
import type { FastifyInstance } from 'fastify';

const { buildApp } = await import('../app.js');
const { loadConfig } = await import('../config.js');

describe('Medical restriction endpoints', () => {
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

  describe('POST /family/members/:memberId/medical-restrictions', () => {
    it('should create a medical restriction', async () => {
      const { accessToken, userId } = await registerUser(app);
      const now = new Date();

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.familyMember.findFirst.mockResolvedValueOnce({
        id: memberId,
        familyId: 'fam-1',
      });
      mockPrisma.medicalRestriction.create.mockResolvedValueOnce({
        id: 'mr-1',
        memberId,
        condition: 'diabetes',
        notes: 'Type 2',
        createdAt: now,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/family/members/${memberId}/medical-restrictions`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { condition: 'diabetes', notes: 'Type 2' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.condition).toBe('diabetes');
      expect(body.notes).toBe('Type 2');
    });
  });

  describe('DELETE /family/members/:memberId/medical-restrictions/:id', () => {
    it('should delete a medical restriction', async () => {
      const { accessToken, userId } = await registerUser(app);
      const restrictionId = '00000000-0000-0000-0000-000000000002';

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.familyMember.findFirst.mockResolvedValueOnce({
        id: memberId,
        familyId: 'fam-1',
      });
      mockPrisma.medicalRestriction.findFirst.mockResolvedValueOnce({
        id: restrictionId,
        memberId,
      });
      mockPrisma.medicalRestriction.delete.mockResolvedValueOnce({ id: restrictionId });

      const response = await app.inject({
        method: 'DELETE',
        url: `/family/members/${memberId}/medical-restrictions/${restrictionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 if restriction not found', async () => {
      const { accessToken, userId } = await registerUser(app);
      const restrictionId = '00000000-0000-0000-0000-000000000099';

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.familyMember.findFirst.mockResolvedValueOnce({
        id: memberId,
        familyId: 'fam-1',
      });
      mockPrisma.medicalRestriction.findFirst.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'DELETE',
        url: `/family/members/${memberId}/medical-restrictions/${restrictionId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
