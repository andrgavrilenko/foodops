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

async function registerAndGetToken(app: FastifyInstance, email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'StrongPass1' },
  });
  const body = res.json();
  return body.access_token as string;
}

describe.skipIf(!dockerAvailable)('Integration: Family CRUD', () => {
  let prisma: PrismaClient;
  let app: FastifyInstance;

  beforeAll(async () => {
    prisma = await setupTestDatabase();

    process.env['DATABASE_URL'] = getConnectionUri();
    process.env['NODE_ENV'] = 'test';
    process.env['LOG_LEVEL'] = 'fatal';
    process.env['JWT_ACCESS_SECRET'] = 'integration-test-access-secret-32-chars-minimum!!';
    process.env['JWT_REFRESH_SECRET'] = 'integration-test-refresh-secret-32-chars-minimum!!';
    process.env['OPENAI_API_KEY'] = 'test-openai-key';
    process.env['OPENAI_MODEL'] = 'gpt-4o-mini';

    const { buildApp } = await import('../../app.js');
    const { loadConfig } = await import('../../config.js');
    const config = loadConfig();
    app = buildApp(config);
    await app.ready();
  }, 120_000);

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  }, 30_000);

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('should create family -> add members -> add restrictions -> cascade delete', async () => {
    const token = await registerAndGetToken(app, 'family-test@example.com');

    // 1. Create family
    const familyRes = await app.inject({
      method: 'POST',
      url: '/family',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Family', meals_per_day: 3, calorie_target_per_person: 2000 },
    });

    expect(familyRes.statusCode).toBe(201);
    const family = familyRes.json();
    expect(family.name).toBe('Test Family');
    expect(family.meals_per_day).toBe(3);

    // 2. Add family member
    const memberRes = await app.inject({
      method: 'POST',
      url: '/family/members',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Alice', age: 30, role: 'ADULT' },
    });

    expect(memberRes.statusCode).toBe(201);
    const member = memberRes.json();
    expect(member.name).toBe('Alice');

    // 3. Add dietary restriction to member
    const dietaryRes = await app.inject({
      method: 'POST',
      url: `/family/members/${member.id}/dietary-restrictions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { type: 'ALLERGY', value: 'peanuts', severity: 'STRICT' },
    });

    expect(dietaryRes.statusCode).toBe(201);
    expect(dietaryRes.json().value).toBe('peanuts');

    // 4. Add medical restriction to member
    const medicalRes = await app.inject({
      method: 'POST',
      url: `/family/members/${member.id}/medical-restrictions`,
      headers: { authorization: `Bearer ${token}` },
      payload: { condition: 'diabetes', notes: 'Type 2' },
    });

    expect(medicalRes.statusCode).toBe(201);

    // 5. Verify family GET returns all nested data
    const getRes = await app.inject({
      method: 'GET',
      url: '/family',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(getRes.statusCode).toBe(200);
    const fullFamily = getRes.json();
    expect(fullFamily.members).toHaveLength(1);
    expect(fullFamily.members[0].dietary_restrictions).toHaveLength(1);
    expect(fullFamily.members[0].medical_restrictions).toHaveLength(1);

    // 6. Delete family — should cascade to members, restrictions
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/family',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(deleteRes.statusCode).toBe(204);

    // 7. Verify family is gone
    const getAfterDelete = await app.inject({
      method: 'GET',
      url: '/family',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(getAfterDelete.statusCode).toBe(404);

    // 8. Verify cascade: member should be gone in the DB
    const memberCount = await prisma.familyMember.count({
      where: { id: member.id },
    });
    expect(memberCount).toBe(0);
  });

  it('should prevent creating a second family for the same user', async () => {
    const token = await registerAndGetToken(app, 'one-family@example.com');

    // Create first family
    const res1 = await app.inject({
      method: 'POST',
      url: '/family',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'First Family' },
    });
    expect(res1.statusCode).toBe(201);

    // Try to create second family
    const res2 = await app.inject({
      method: 'POST',
      url: '/family',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Second Family' },
    });
    expect(res2.statusCode).toBe(409);
  });
});
