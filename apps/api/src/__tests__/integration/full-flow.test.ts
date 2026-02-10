import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mockPrisma } from '../helpers/setup.js';
import { registerUser } from '../helpers/auth-helper.js';
import type { FastifyInstance } from 'fastify';

const { buildApp } = await import('../../app.js');
const { loadConfig } = await import('../../config.js');

describe('Full flow: register -> family -> members -> restrictions -> preferences', () => {
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

  it('should complete the full user + family setup flow', async () => {
    const now = new Date();
    const { accessToken, userId } = await registerUser(app);

    // Use valid UUIDs for IDs that get parsed by uuidSchema
    const memberId = '00000000-0000-4000-a000-000000000001';
    const drId = '00000000-0000-4000-a000-000000000002';
    const mrId = '00000000-0000-4000-a000-000000000003';

    // Step 1: Create family
    mockPrisma.family.create.mockResolvedValueOnce({
      id: 'fam-flow',
      userId,
      name: 'Flow Family',
      weeklyBudget: null,
      mealsPerDay: 3,
      calorieTargetPerPerson: 2000,
      preferredStoreId: null,
      createdAt: now,
      updatedAt: now,
    });
    mockPrisma.family.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'fam-flow',
      userId,
      name: 'Flow Family',
      weeklyBudget: null,
      mealsPerDay: 3,
      calorieTargetPerPerson: 2000,
      preferredStoreId: null,
      createdAt: now,
      updatedAt: now,
    });

    const familyRes = await app.inject({
      method: 'POST',
      url: '/family',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Flow Family', calorie_target_per_person: 2000 },
    });

    expect(familyRes.statusCode).toBe(201);
    expect(familyRes.json().name).toBe('Flow Family');

    // Step 2: Add family member
    mockPrisma.family.findUnique.mockResolvedValueOnce({
      id: 'fam-flow',
      userId,
    });
    mockPrisma.familyMember.count.mockResolvedValueOnce(0);
    mockPrisma.familyMember.create.mockResolvedValueOnce({
      id: memberId,
      familyId: 'fam-flow',
      name: 'Alice',
      age: 30,
      role: 'ADULT',
      createdAt: now,
      updatedAt: now,
    });

    const memberRes = await app.inject({
      method: 'POST',
      url: '/family/members',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: 'Alice', age: 30, role: 'ADULT' },
    });

    expect(memberRes.statusCode).toBe(201);
    expect(memberRes.json().name).toBe('Alice');

    // Step 3: Add dietary restriction to member
    mockPrisma.family.findUnique.mockResolvedValueOnce({
      id: 'fam-flow',
      userId,
    });
    mockPrisma.familyMember.findFirst.mockResolvedValueOnce({
      id: memberId,
      familyId: 'fam-flow',
    });
    mockPrisma.dietaryRestriction.create.mockResolvedValueOnce({
      id: drId,
      memberId,
      type: 'ALLERGY',
      value: 'peanuts',
      severity: 'STRICT',
      createdAt: now,
    });

    const dietaryRes = await app.inject({
      method: 'POST',
      url: `/family/members/${memberId}/dietary-restrictions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: 'ALLERGY', value: 'peanuts', severity: 'STRICT' },
    });

    expect(dietaryRes.statusCode).toBe(201);
    expect(dietaryRes.json().value).toBe('peanuts');

    // Step 4: Add medical restriction to member
    mockPrisma.family.findUnique.mockResolvedValueOnce({
      id: 'fam-flow',
      userId,
    });
    mockPrisma.familyMember.findFirst.mockResolvedValueOnce({
      id: memberId,
      familyId: 'fam-flow',
    });
    mockPrisma.medicalRestriction.create.mockResolvedValueOnce({
      id: mrId,
      memberId,
      condition: 'diabetes',
      notes: 'Type 2',
      createdAt: now,
    });

    const medicalRes = await app.inject({
      method: 'POST',
      url: `/family/members/${memberId}/medical-restrictions`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { condition: 'diabetes', notes: 'Type 2' },
    });

    expect(medicalRes.statusCode).toBe(201);
    expect(medicalRes.json().condition).toBe('diabetes');

    // Step 5: Add preference
    mockPrisma.family.findUnique.mockResolvedValueOnce({
      id: 'fam-flow',
      userId,
    });
    mockPrisma.preference.create.mockResolvedValueOnce({
      id: 'pref-flow',
      familyId: 'fam-flow',
      type: 'CUISINE',
      value: 'Italian',
      createdAt: now,
    });

    const prefRes = await app.inject({
      method: 'POST',
      url: '/family/preferences',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: 'CUISINE', value: 'Italian' },
    });

    expect(prefRes.statusCode).toBe(201);
    expect(prefRes.json().value).toBe('Italian');

    // Step 6: GET /family — verify all nested data
    mockPrisma.family.findUnique.mockResolvedValueOnce({
      id: 'fam-flow',
      userId,
      name: 'Flow Family',
      weeklyBudget: null,
      mealsPerDay: 3,
      calorieTargetPerPerson: 2000,
      preferredStoreId: null,
      createdAt: now,
      updatedAt: now,
      members: [
        {
          id: memberId,
          name: 'Alice',
          age: 30,
          role: 'ADULT',
          createdAt: now,
          updatedAt: now,
          dietaryRestrictions: [
            {
              id: drId,
              type: 'ALLERGY',
              value: 'peanuts',
              severity: 'STRICT',
              createdAt: now,
            },
          ],
          medicalRestrictions: [
            {
              id: mrId,
              condition: 'diabetes',
              notes: 'Type 2',
              createdAt: now,
            },
          ],
        },
      ],
      preferences: [
        {
          id: 'pref-flow',
          type: 'CUISINE',
          value: 'Italian',
          createdAt: now,
        },
      ],
    });

    const getRes = await app.inject({
      method: 'GET',
      url: '/family',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(getRes.statusCode).toBe(200);
    const family = getRes.json();
    expect(family.name).toBe('Flow Family');
    expect(family.calorie_target_per_person).toBe(2000);
    expect(family.preferred_store_id).toBeNull();
    expect(family.members).toHaveLength(1);
    expect(family.members[0].name).toBe('Alice');
    expect(family.members[0].dietary_restrictions).toHaveLength(1);
    expect(family.members[0].dietary_restrictions[0].value).toBe('peanuts');
    expect(family.members[0].medical_restrictions).toHaveLength(1);
    expect(family.members[0].medical_restrictions[0].condition).toBe('diabetes');
    expect(family.preferences).toHaveLength(1);
    expect(family.preferences[0].value).toBe('Italian');
  });
});
