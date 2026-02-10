import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mockPrisma } from './helpers/setup.js';
import { registerUser } from './helpers/auth-helper.js';
import type { FastifyInstance } from 'fastify';

const { buildApp } = await import('../app.js');
const { loadConfig } = await import('../config.js');

const recipeId = '00000000-0000-4000-a000-000000000010';
const otherRecipeId = '00000000-0000-4000-a000-000000000011';

function mockRecipe(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: recipeId,
    titleEn: 'Pasta Carbonara',
    titleFi: 'Pasta Carbonara',
    descriptionEn: 'Classic Italian pasta',
    descriptionFi: 'Klassinen italialainen pasta',
    cuisineType: 'Italian',
    prepTimeMin: 30,
    caloriesPerServing: 500,
    proteinPerServing: 20,
    carbsPerServing: 60,
    fatPerServing: 15,
    tags: ['pasta', 'italian'],
    isCustom: true,
    userId: 'user-id-1',
    source: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Recipe endpoints', () => {
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

  describe('POST /recipes', () => {
    it('should create a recipe', async () => {
      const { accessToken, userId } = await registerUser(app);
      const recipe = mockRecipe({ userId });

      mockPrisma.recipe.create.mockResolvedValueOnce(recipe);

      const response = await app.inject({
        method: 'POST',
        url: '/recipes',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          title_en: 'Pasta Carbonara',
          title_fi: 'Pasta Carbonara',
          description_en: 'Classic Italian pasta',
          description_fi: 'Klassinen italialainen pasta',
          cuisine_type: 'Italian',
          prep_time_min: 30,
          calories_per_serving: 500,
          tags: ['pasta', 'italian'],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.title_en).toBe('Pasta Carbonara');
      expect(body.cuisine_type).toBe('Italian');
      expect(body.is_custom).toBe(true);
      expect(body.tags).toEqual(['pasta', 'italian']);
      expect(body.created_at).toBeDefined();
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/recipes',
        payload: { title_en: 'Test', title_fi: 'Test' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing required fields', async () => {
      const { accessToken } = await registerUser(app);

      const response = await app.inject({
        method: 'POST',
        url: '/recipes',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { title_en: 'Test' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /recipes/:id', () => {
    it('should return a recipe by id', async () => {
      const { accessToken, userId } = await registerUser(app);
      const recipe = mockRecipe({ userId });

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(recipe);

      const response = await app.inject({
        method: 'GET',
        url: `/recipes/${recipeId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.id).toBe(recipeId);
      expect(body.title_en).toBe('Pasta Carbonara');
      expect(body.protein_per_serving).toBe(20);
    });

    it('should return 404 if recipe not found', async () => {
      const { accessToken } = await registerUser(app);

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: `/recipes/${recipeId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('RECIPE_NOT_FOUND');
    });

    it('should return 400 for invalid uuid', async () => {
      const { accessToken } = await registerUser(app);

      const response = await app.inject({
        method: 'GET',
        url: '/recipes/not-a-uuid',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /recipes', () => {
    it('should list recipes with pagination', async () => {
      const { accessToken, userId } = await registerUser(app);
      const recipes = [mockRecipe({ userId }), mockRecipe({ id: otherRecipeId, userId })];

      mockPrisma.recipe.findMany.mockResolvedValueOnce(recipes);
      mockPrisma.recipe.count.mockResolvedValueOnce(2);

      const response = await app.inject({
        method: 'GET',
        url: '/recipes?page=1&limit=10',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(2);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.total_pages).toBe(1);
    });

    it('should filter by cuisine_type', async () => {
      const { accessToken, userId } = await registerUser(app);

      mockPrisma.recipe.findMany.mockResolvedValueOnce([mockRecipe({ userId })]);
      mockPrisma.recipe.count.mockResolvedValueOnce(1);

      const response = await app.inject({
        method: 'GET',
        url: '/recipes?cuisine_type=Italian',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toHaveLength(1);
    });

    it('should return empty list when no recipes', async () => {
      const { accessToken } = await registerUser(app);

      mockPrisma.recipe.findMany.mockResolvedValueOnce([]);
      mockPrisma.recipe.count.mockResolvedValueOnce(0);

      const response = await app.inject({
        method: 'GET',
        url: '/recipes',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
      expect(body.pagination.total_pages).toBe(0);
    });
  });

  describe('PATCH /recipes/:id', () => {
    it('should update a recipe', async () => {
      const { accessToken, userId } = await registerUser(app);
      const recipe = mockRecipe({ userId });

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(recipe);
      mockPrisma.recipe.update.mockResolvedValueOnce({
        ...recipe,
        titleEn: 'Updated Pasta',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/recipes/${recipeId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { title_en: 'Updated Pasta' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title_en).toBe('Updated Pasta');
    });

    it('should return 404 if recipe not found', async () => {
      const { accessToken } = await registerUser(app);

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'PATCH',
        url: `/recipes/${recipeId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { title_en: 'Updated' },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('RECIPE_NOT_FOUND');
    });

    it('should return 403 if not the recipe owner', async () => {
      const { accessToken } = await registerUser(app);
      const recipe = mockRecipe({ userId: 'other-user-id' });

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(recipe);

      const response = await app.inject({
        method: 'PATCH',
        url: `/recipes/${recipeId}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { title_en: 'Stolen Recipe' },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe('RECIPE_NOT_OWNER');
    });
  });

  describe('DELETE /recipes/:id', () => {
    it('should delete a recipe', async () => {
      const { accessToken, userId } = await registerUser(app);
      const recipe = mockRecipe({ userId });

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(recipe);
      mockPrisma.recipe.delete.mockResolvedValueOnce(recipe);

      const response = await app.inject({
        method: 'DELETE',
        url: `/recipes/${recipeId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 if recipe not found', async () => {
      const { accessToken } = await registerUser(app);

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'DELETE',
        url: `/recipes/${recipeId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('RECIPE_NOT_FOUND');
    });

    it('should return 403 if not the recipe owner', async () => {
      const { accessToken } = await registerUser(app);
      const recipe = mockRecipe({ userId: 'other-user-id' });

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(recipe);

      const response = await app.inject({
        method: 'DELETE',
        url: `/recipes/${recipeId}`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe('RECIPE_NOT_OWNER');
    });
  });
});
