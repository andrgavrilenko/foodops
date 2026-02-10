import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import './helpers/setup.js';
import { mockPrisma } from './helpers/setup.js';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import type { FastifyInstance } from 'fastify';
import { registerUser } from './helpers/auth-helper.js';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

let app: FastifyInstance;

const familyId = '00000000-0000-0000-0000-000000000001';
const menuId = '00000000-0000-0000-0000-000000000002';
const mealId = '00000000-0000-0000-0000-000000000003';
const recipeId = '00000000-0000-0000-0000-000000000004';

const mockMenuDay = {
  id: '00000000-0000-0000-0000-000000000010',
  menuId,
  dayOfWeek: 1,
  date: new Date('2026-02-16'),
  meals: [
    {
      id: mealId,
      menuDayId: '00000000-0000-0000-0000-000000000010',
      mealType: 'LUNCH',
      recipeId,
      isLocked: false,
      servings: 1,
      recipe: {
        id: recipeId,
        titleEn: 'Test Recipe',
        titleFi: 'Testiresepti',
        descriptionEn: null,
        descriptionFi: null,
        cuisineType: null,
        prepTimeMin: 30,
        caloriesPerServing: 400,
        proteinPerServing: null,
        carbsPerServing: null,
        fatPerServing: null,
        tags: [],
        isCustom: false,
        userId: null,
        source: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  ],
};

const mockMenu = {
  id: menuId,
  familyId,
  weekStart: new Date('2026-02-16'),
  status: 'DRAFT',
  totalCostEstimate: null,
  totalCalories: 8400,
  createdAt: new Date(),
  menuDays: [mockMenuDay],
};

function makeMockFamily(userId: string) {
  return {
    id: familyId,
    userId,
    name: 'Test Family',
    weeklyBudget: null,
    mealsPerDay: 3,
    calorieTargetPerPerson: null,
    preferredStoreId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [
      {
        id: '00000000-0000-0000-0000-000000000020',
        familyId,
        name: 'Adult',
        age: 30,
        role: 'ADULT',
        createdAt: new Date(),
        updatedAt: new Date(),
        dietaryRestrictions: [],
        medicalRestrictions: [],
      },
    ],
    preferences: [],
  };
}

beforeAll(async () => {
  const config = loadConfig();
  app = buildApp(config);
  await app.ready();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Menu API', () => {
  describe('POST /menu/generate', () => {
    it('should return 404 if family not found', async () => {
      const { accessToken } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/menu/generate',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {},
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('MENU_FAMILY_NOT_FOUND');
    });

    it('should return 400 if family has no members', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue({
        ...makeMockFamily(userId),
        members: [],
      });

      const res = await app.inject({
        method: 'POST',
        url: '/menu/generate',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('MENU_FAMILY_INCOMPLETE');
    });

    it('should validate week_start is a Monday', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));

      const res = await app.inject({
        method: 'POST',
        url: '/menu/generate',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { week_start: '2026-02-17' }, // Tuesday
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('MENU_INVALID_WEEK_START');
    });
  });

  describe('GET /menu/current', () => {
    it('should return 404 if no family', async () => {
      const { accessToken } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/menu/current',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('MENU_FAMILY_NOT_FOUND');
    });

    it('should return 404 if no menus exist', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));
      mockPrisma.weeklyMenu.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/menu/current',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('MENU_NOT_FOUND');
    });

    it('should return current menu', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));
      mockPrisma.weeklyMenu.findFirst.mockResolvedValue(mockMenu);

      const res = await app.inject({
        method: 'GET',
        url: '/menu/current',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(menuId);
      expect(body.status).toBe('DRAFT');
      expect(body.days).toHaveLength(1);
    });
  });

  describe('GET /menu/:id', () => {
    it('should return 404 if menu not found', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));
      mockPrisma.weeklyMenu.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: `/menu/${menuId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('MENU_NOT_FOUND');
    });

    it('should return 403 if menu belongs to another family', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));
      mockPrisma.weeklyMenu.findUnique.mockResolvedValue({
        ...mockMenu,
        familyId: '00000000-0000-0000-0000-999999999999',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/menu/${menuId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('MENU_ACCESS_DENIED');
    });

    it('should return menu by ID', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));
      mockPrisma.weeklyMenu.findUnique.mockResolvedValue(mockMenu);

      const res = await app.inject({
        method: 'GET',
        url: `/menu/${menuId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe(menuId);
    });
  });

  describe('GET /menu/history', () => {
    it('should return paginated menu history', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));
      mockPrisma.weeklyMenu.findMany.mockResolvedValue([{ ...mockMenu, menuDays: undefined }]);
      mockPrisma.weeklyMenu.count.mockResolvedValue(1);

      const res = await app.inject({
        method: 'GET',
        url: '/menu/history?page=1&limit=10',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });
  });

  describe('PATCH /menu/:menuId/meals/:mealId', () => {
    it('should return 400 if menu is not DRAFT', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));
      mockPrisma.weeklyMenu.findUnique.mockResolvedValue({
        ...mockMenu,
        status: 'APPROVED',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/menu/${menuId}/meals/${mealId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { recipe_id: '00000000-0000-0000-0000-000000000099' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('MENU_NOT_DRAFT');
    });

    it('should return 404 if meal not found', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));
      mockPrisma.weeklyMenu.findUnique.mockResolvedValue(mockMenu);

      const fakeMealId = '00000000-0000-0000-0000-000000000088';
      const res = await app.inject({
        method: 'PATCH',
        url: `/menu/${menuId}/meals/${fakeMealId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { recipe_id: '00000000-0000-0000-0000-000000000099' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('MEAL_NOT_FOUND');
    });

    it('should replace meal recipe', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));
      mockPrisma.weeklyMenu.findUnique.mockResolvedValue(mockMenu);
      const newRecipe = {
        id: '00000000-0000-0000-0000-000000000050',
        titleEn: 'New Recipe',
        titleFi: 'Uusi resepti',
        descriptionEn: null,
        descriptionFi: null,
        cuisineType: null,
        prepTimeMin: 25,
        caloriesPerServing: 350,
        proteinPerServing: null,
        carbsPerServing: null,
        fatPerServing: null,
        tags: [],
      };
      mockPrisma.recipe.findUnique.mockResolvedValue(newRecipe);
      mockPrisma.meal.update.mockResolvedValue({
        id: mealId,
        mealType: 'LUNCH',
        isLocked: false,
        servings: 1,
        recipe: newRecipe,
      });
      mockPrisma.meal.findMany.mockResolvedValue([
        { servings: 1, recipe: { caloriesPerServing: 350 } },
      ]);
      mockPrisma.weeklyMenu.update.mockResolvedValue({});

      const res = await app.inject({
        method: 'PATCH',
        url: `/menu/${menuId}/meals/${mealId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { recipe_id: '00000000-0000-0000-0000-000000000050' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().recipe.title_en).toBe('New Recipe');
    });
  });

  describe('PATCH /menu/:menuId/meals/:mealId/lock', () => {
    it('should lock a meal', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));
      mockPrisma.weeklyMenu.findUnique.mockResolvedValue(mockMenu);
      mockPrisma.meal.update.mockResolvedValue({
        id: mealId,
        mealType: 'LUNCH',
        isLocked: true,
        servings: 1,
        recipe: mockMenuDay.meals[0]!.recipe,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/menu/${menuId}/meals/${mealId}/lock`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { is_locked: true },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().is_locked).toBe(true);
    });
  });

  describe('POST /menu/:id/approve', () => {
    it('should approve a draft menu', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));
      mockPrisma.weeklyMenu.findUnique.mockResolvedValue(mockMenu);
      mockPrisma.weeklyMenu.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.weeklyMenu.update.mockResolvedValue({
        ...mockMenu,
        status: 'APPROVED',
      });

      const res = await app.inject({
        method: 'POST',
        url: `/menu/${menuId}/approve`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('APPROVED');
    });

    it('should return 400 if already approved', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));
      mockPrisma.weeklyMenu.findUnique.mockResolvedValue({
        ...mockMenu,
        status: 'APPROVED',
      });

      const res = await app.inject({
        method: 'POST',
        url: `/menu/${menuId}/approve`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('MENU_ALREADY_APPROVED');
    });

    it('should return 400 if archived', async () => {
      const { accessToken, userId } = await registerUser(app);
      mockPrisma.family.findUnique.mockResolvedValue(makeMockFamily(userId));
      mockPrisma.weeklyMenu.findUnique.mockResolvedValue({
        ...mockMenu,
        status: 'ARCHIVED',
      });

      const res = await app.inject({
        method: 'POST',
        url: `/menu/${menuId}/approve`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('MENU_ALREADY_ARCHIVED');
    });
  });

  describe('Auth required', () => {
    it('should return 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/menu/current',
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
