import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mockPrisma } from './helpers/setup.js';
import { registerUser } from './helpers/auth-helper.js';
import type { FastifyInstance } from 'fastify';

const { buildApp } = await import('../app.js');
const { loadConfig } = await import('../config.js');

describe('Preference endpoints', () => {
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

  describe('POST /family/preferences', () => {
    it('should create a preference', async () => {
      const { accessToken, userId } = await registerUser(app);
      const now = new Date();

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.preference.create.mockResolvedValueOnce({
        id: 'pref-1',
        familyId: 'fam-1',
        type: 'CUISINE',
        value: 'Italian',
        createdAt: now,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/family/preferences',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { type: 'CUISINE', value: 'Italian' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.type).toBe('CUISINE');
      expect(body.value).toBe('Italian');
    });

    it('should return 404 if no family exists', async () => {
      const { accessToken } = await registerUser(app);

      mockPrisma.family.findUnique.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: '/family/preferences',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { type: 'CUISINE', value: 'Italian' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /family/preferences', () => {
    it('should list preferences', async () => {
      const { accessToken, userId } = await registerUser(app);
      const now = new Date();

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.preference.findMany.mockResolvedValueOnce([
        { id: 'p1', familyId: 'fam-1', type: 'CUISINE', value: 'Italian', createdAt: now },
        {
          id: 'p2',
          familyId: 'fam-1',
          type: 'EXCLUDED_INGREDIENT',
          value: 'olives',
          createdAt: now,
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/family/preferences',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveLength(2);
    });
  });

  describe('DELETE /family/preferences/:id', () => {
    it('should delete a preference', async () => {
      const { accessToken, userId } = await registerUser(app);
      const prefId = '00000000-0000-0000-0000-000000000001';

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.preference.findFirst.mockResolvedValueOnce({
        id: prefId,
        familyId: 'fam-1',
      });
      mockPrisma.preference.delete.mockResolvedValueOnce({ id: prefId });

      const response = await app.inject({
        method: 'DELETE',
        url: `/family/preferences/${prefId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 if preference not found', async () => {
      const { accessToken, userId } = await registerUser(app);
      const prefId = '00000000-0000-0000-0000-000000000099';

      mockPrisma.family.findUnique.mockResolvedValueOnce({ id: 'fam-1', userId });
      mockPrisma.preference.findFirst.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'DELETE',
        url: `/family/preferences/${prefId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
