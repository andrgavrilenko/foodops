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
  return res.json().access_token as string;
}

describe.skipIf(!dockerAvailable)('Integration: Recipe CRUD', () => {
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

  it('should create -> list (privacy) -> delete recipe', async () => {
    const token1 = await registerAndGetToken(app, 'chef1@example.com');
    const token2 = await registerAndGetToken(app, 'chef2@example.com');

    // 1. User1 creates a custom recipe
    const createRes = await app.inject({
      method: 'POST',
      url: '/recipes',
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        title_en: 'Mushroom Risotto',
        title_fi: 'Sieniriso',
        cuisine_type: 'Italian',
        prep_time_min: 45,
        calories_per_serving: 500,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const recipe = createRes.json();
    expect(recipe.title_en).toBe('Mushroom Risotto');
    expect(recipe.is_custom).toBe(true);

    // 2. User1 can see their recipe in list
    const listRes1 = await app.inject({
      method: 'GET',
      url: '/recipes',
      headers: { authorization: `Bearer ${token1}` },
    });

    expect(listRes1.statusCode).toBe(200);
    const list1 = listRes1.json();
    expect(list1.data.length).toBeGreaterThanOrEqual(1);
    expect(list1.data.some((r: { id: string }) => r.id === recipe.id)).toBe(true);

    // 3. User2 should NOT see user1's custom recipe in their list
    const listRes2 = await app.inject({
      method: 'GET',
      url: '/recipes',
      headers: { authorization: `Bearer ${token2}` },
    });

    expect(listRes2.statusCode).toBe(200);
    const list2 = listRes2.json();
    expect(list2.data.some((r: { id: string }) => r.id === recipe.id)).toBe(false);

    // 4. User1 deletes the recipe
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/recipes/${recipe.id}`,
      headers: { authorization: `Bearer ${token1}` },
    });

    expect(deleteRes.statusCode).toBe(204);

    // 5. Recipe should no longer exist in DB
    const count = await prisma.recipe.count({ where: { id: recipe.id } });
    expect(count).toBe(0);
  });

  it('should prevent non-owner from deleting a recipe', async () => {
    const token1 = await registerAndGetToken(app, 'owner@example.com');
    const token2 = await registerAndGetToken(app, 'stranger@example.com');

    // User1 creates recipe
    const createRes = await app.inject({
      method: 'POST',
      url: '/recipes',
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        title_en: 'Secret Recipe',
        title_fi: 'Salainen Resepti',
      },
    });

    const recipe = createRes.json();

    // User2 tries to delete it
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/recipes/${recipe.id}`,
      headers: { authorization: `Bearer ${token2}` },
    });

    expect(deleteRes.statusCode).toBe(403);
  });
});
