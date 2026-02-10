import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mockPrisma } from './helpers/setup.js';
import { registerUser } from './helpers/auth-helper.js';
import type { FastifyInstance } from 'fastify';

const { buildApp } = await import('../app.js');
const { loadConfig } = await import('../config.js');

describe('Family endpoints', () => {
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

  describe('POST /family', () => {
    it('should create a family', async () => {
      const { accessToken, userId } = await registerUser(app);
      const now = new Date();

      mockPrisma.family.create.mockResolvedValueOnce({
        id: 'fam-1',
        userId,
        name: 'Test Family',
        weeklyBudget: null,
        mealsPerDay: 3,
        calorieTargetPerPerson: null,
        preferredStoreId: null,
        createdAt: now,
        updatedAt: now,
      });
      mockPrisma.family.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'fam-1',
        userId,
        name: 'Test Family',
        weeklyBudget: null,
        mealsPerDay: 3,
        calorieTargetPerPerson: null,
        preferredStoreId: null,
        createdAt: now,
        updatedAt: now,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/family',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Test Family' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.name).toBe('Test Family');
      expect(body.meals_per_day).toBe(3);
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/family',
        payload: { name: 'Test Family' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 409 if user already has a family', async () => {
      const { accessToken } = await registerUser(app);

      const prismaError = new Error('Unique constraint') as Error & { code: string };
      prismaError.code = 'P2002';
      mockPrisma.family.create.mockRejectedValueOnce(prismaError);

      const response = await app.inject({
        method: 'POST',
        url: '/family',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'Duplicate Family' },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.error.code).toBe('FAMILY_ALREADY_EXISTS');
    });
  });

  describe('GET /family', () => {
    it('should return family with members and preferences', async () => {
      const { accessToken, userId } = await registerUser(app);
      const now = new Date();

      mockPrisma.family.findUnique.mockResolvedValueOnce({
        id: 'fam-1',
        userId,
        name: 'Test Family',
        weeklyBudget: null,
        mealsPerDay: 3,
        calorieTargetPerPerson: 2000,
        preferredStoreId: null,
        createdAt: now,
        updatedAt: now,
        members: [
          {
            id: 'mem-1',
            name: 'Alice',
            age: 30,
            role: 'ADULT',
            createdAt: now,
            updatedAt: now,
            dietaryRestrictions: [],
            medicalRestrictions: [],
          },
        ],
        preferences: [{ id: 'pref-1', type: 'CUISINE', value: 'Italian', createdAt: now }],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/family',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe('Test Family');
      expect(body.calorie_target_per_person).toBe(2000);
      expect(body.members).toHaveLength(1);
      expect(body.members[0].name).toBe('Alice');
      expect(body.preferences).toHaveLength(1);
    });

    it('should return 404 if no family', async () => {
      const { accessToken } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/family',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('FAMILY_NOT_FOUND');
    });
  });

  describe('PATCH /family', () => {
    it('should update family name', async () => {
      const { accessToken, userId } = await registerUser(app);
      const now = new Date();

      // verifyFamilyOwnership
      mockPrisma.family.findUnique.mockResolvedValueOnce({
        id: 'fam-1',
        userId,
        name: 'Old Name',
        weeklyBudget: null,
        mealsPerDay: 3,
        calorieTargetPerPerson: null,
        preferredStoreId: null,
        createdAt: now,
        updatedAt: now,
      });

      mockPrisma.family.update.mockResolvedValueOnce({
        id: 'fam-1',
        userId,
        name: 'New Name',
        weeklyBudget: null,
        mealsPerDay: 3,
        calorieTargetPerPerson: null,
        preferredStoreId: null,
        createdAt: now,
        updatedAt: now,
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/family',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe('New Name');
    });
  });
});
