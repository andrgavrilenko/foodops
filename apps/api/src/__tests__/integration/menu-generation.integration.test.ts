import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
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

// Mock OpenAI to avoid real API calls while testing real DB flow
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

function makeIngredient(name: string) {
  return {
    name_en: name,
    name_fi: `${name}_fi`,
    quantity: 100,
    unit: 'g',
    category: 'produce',
    is_optional: false,
  };
}

function makeRecipe(title: string) {
  return {
    title_en: title,
    title_fi: `${title}_fi`,
    description_en: `${title} description`,
    description_fi: `${title} kuvaus`,
    cuisine_type: 'international',
    prep_time_min: 30,
    calories_per_serving: 400,
    protein_per_serving: 20,
    carbs_per_serving: 50,
    fat_per_serving: 15,
    tags: ['easy'],
    ingredients: [makeIngredient('tomato'), makeIngredient('onion'), makeIngredient('salt')],
  };
}

function makeValidMenuResponse(mealsPerDay = 3): string {
  const mealTypes = ['breakfast', 'lunch', 'dinner'].slice(0, mealsPerDay);
  const days = Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i + 1,
    meals: mealTypes.map((type) => ({
      meal_type: type,
      recipe: makeRecipe(`Day${i + 1}-${type}`),
    })),
  }));
  return JSON.stringify({ days, total_estimated_cost_eur: 80 });
}

async function registerAndGetToken(app: FastifyInstance, email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'StrongPass1' },
  });
  return res.json().access_token as string;
}

async function createFamilyWithMember(app: FastifyInstance, token: string) {
  // Create family
  await app.inject({
    method: 'POST',
    url: '/family',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'Menu Test Family', meals_per_day: 3, calorie_target_per_person: 2000 },
  });

  // Add a member
  await app.inject({
    method: 'POST',
    url: '/family/members',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'Alice', age: 30, role: 'ADULT' },
  });
}

describe.skipIf(!dockerAvailable)('Integration: Menu generation', () => {
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
    vi.clearAllMocks();
  });

  it('should create user + family -> generate menu -> verify DB records', async () => {
    // Mock OpenAI response
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: makeValidMenuResponse(3) } }],
    });

    const token = await registerAndGetToken(app, 'menu-test@example.com');
    await createFamilyWithMember(app, token);

    // Generate menu
    const generateRes = await app.inject({
      method: 'POST',
      url: '/menu/generate',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(generateRes.statusCode).toBe(200);
    const menu = generateRes.json();
    expect(menu.id).toBeDefined();
    expect(menu.status).toBe('DRAFT');
    expect(menu.days).toHaveLength(7);

    // Verify DB records exist
    const dbMenu = await prisma.weeklyMenu.findUnique({
      where: { id: menu.id },
      include: {
        menuDays: {
          include: { meals: true },
        },
      },
    });

    expect(dbMenu).not.toBeNull();
    expect(dbMenu!.menuDays).toHaveLength(7);
    // Each day should have 3 meals
    for (const day of dbMenu!.menuDays) {
      expect(day.meals).toHaveLength(3);
    }

    // Total meals: 7 days * 3 meals = 21
    const totalMeals = dbMenu!.menuDays.reduce((sum, d) => sum + d.meals.length, 0);
    expect(totalMeals).toBe(21);

    // Verify recipes were created
    const recipeCount = await prisma.recipe.count();
    expect(recipeCount).toBe(21); // 21 unique recipes

    // Verify ingredients were created
    const ingredientCount = await prisma.ingredient.count();
    expect(ingredientCount).toBeGreaterThan(0);
  });

  it('should return current menu via GET /menu/current', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: makeValidMenuResponse(3) } }],
    });

    const token = await registerAndGetToken(app, 'current-test@example.com');
    await createFamilyWithMember(app, token);

    // Generate
    await app.inject({
      method: 'POST',
      url: '/menu/generate',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    // Get current
    const currentRes = await app.inject({
      method: 'GET',
      url: '/menu/current',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(currentRes.statusCode).toBe(200);
    const current = currentRes.json();
    expect(current.status).toBe('DRAFT');
    expect(current.days).toHaveLength(7);
  });
});
