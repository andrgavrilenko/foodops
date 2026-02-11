import type { PrismaClient, Prisma } from '@foodops/db';
import { AppError, ErrorCodes } from '../lib/errors.js';
import { toRecipeResponse } from '../lib/response-mappers.js';
import type { FastifyBaseLogger } from '../lib/logger.js';

export function createRecipeService(prisma: PrismaClient) {
  return {
    async create(
      userId: string,
      data: {
        title_en: string;
        title_fi: string;
        description_en?: string | null;
        description_fi?: string | null;
        cuisine_type?: string | null;
        prep_time_min?: number | null;
        calories_per_serving?: number | null;
        protein_per_serving?: number | null;
        carbs_per_serving?: number | null;
        fat_per_serving?: number | null;
        tags?: string[];
        source?: string | null;
      },
      log?: FastifyBaseLogger,
    ) {
      const recipe = await prisma.recipe.create({
        data: {
          userId,
          titleEn: data.title_en,
          titleFi: data.title_fi,
          descriptionEn: data.description_en ?? null,
          descriptionFi: data.description_fi ?? null,
          cuisineType: data.cuisine_type ?? null,
          prepTimeMin: data.prep_time_min ?? null,
          caloriesPerServing: data.calories_per_serving ?? null,
          proteinPerServing: data.protein_per_serving ?? null,
          carbsPerServing: data.carbs_per_serving ?? null,
          fatPerServing: data.fat_per_serving ?? null,
          tags: data.tags ?? [],
          isCustom: true,
          source: data.source ?? null,
        },
      });
      log?.info({ event: 'recipe_created', userId, recipeId: recipe.id, isCustom: true }, 'Recipe created');
      return toRecipeResponse(recipe);
    },

    async get(recipeId: string) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: recipeId },
      });
      if (!recipe) {
        throw new AppError('Recipe not found', 404, ErrorCodes.RECIPE_NOT_FOUND);
      }
      return toRecipeResponse(recipe);
    },

    async list(userId: string, query: { page: number; limit: number; cuisine_type?: string }) {
      const where: Prisma.RecipeWhereInput = {
        OR: [{ isCustom: false }, { userId }],
      };
      if (query.cuisine_type) {
        where.AND = [{ cuisineType: query.cuisine_type }];
      }

      const [recipes, total] = await Promise.all([
        prisma.recipe.findMany({
          where,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.recipe.count({ where }),
      ]);

      return {
        data: recipes.map(toRecipeResponse),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          total_pages: Math.ceil(total / query.limit),
        },
      };
    },

    async update(
      userId: string,
      recipeId: string,
      data: {
        title_en?: string;
        title_fi?: string;
        description_en?: string | null;
        description_fi?: string | null;
        cuisine_type?: string | null;
        prep_time_min?: number | null;
        calories_per_serving?: number | null;
        protein_per_serving?: number | null;
        carbs_per_serving?: number | null;
        fat_per_serving?: number | null;
        tags?: string[] | null;
        source?: string | null;
      },
      log?: FastifyBaseLogger,
    ) {
      const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
      if (!recipe) {
        throw new AppError('Recipe not found', 404, ErrorCodes.RECIPE_NOT_FOUND);
      }
      if (recipe.userId !== userId) {
        throw new AppError('Not the recipe owner', 403, ErrorCodes.RECIPE_NOT_OWNER);
      }

      const updateData: Prisma.RecipeUncheckedUpdateInput = {};
      if (data.title_en !== undefined) updateData.titleEn = data.title_en;
      if (data.title_fi !== undefined) updateData.titleFi = data.title_fi;
      if (data.description_en !== undefined) updateData.descriptionEn = data.description_en;
      if (data.description_fi !== undefined) updateData.descriptionFi = data.description_fi;
      if (data.cuisine_type !== undefined) updateData.cuisineType = data.cuisine_type;
      if (data.prep_time_min !== undefined) updateData.prepTimeMin = data.prep_time_min;
      if (data.calories_per_serving !== undefined)
        updateData.caloriesPerServing = data.calories_per_serving;
      if (data.protein_per_serving !== undefined)
        updateData.proteinPerServing = data.protein_per_serving;
      if (data.carbs_per_serving !== undefined) updateData.carbsPerServing = data.carbs_per_serving;
      if (data.fat_per_serving !== undefined) updateData.fatPerServing = data.fat_per_serving;
      if (data.tags !== undefined) updateData.tags = data.tags ?? [];
      if (data.source !== undefined) updateData.source = data.source;

      const updated = await prisma.recipe.update({
        where: { id: recipeId },
        data: updateData,
      });
      log?.info({ event: 'recipe_updated', userId, recipeId }, 'Recipe updated');
      return toRecipeResponse(updated);
    },

    async delete(userId: string, recipeId: string, log?: FastifyBaseLogger) {
      const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
      if (!recipe) {
        throw new AppError('Recipe not found', 404, ErrorCodes.RECIPE_NOT_FOUND);
      }
      if (recipe.userId !== userId) {
        throw new AppError('Not the recipe owner', 403, ErrorCodes.RECIPE_NOT_OWNER);
      }

      const activeMealCount = await prisma.meal.count({ where: { recipeId } });
      if (activeMealCount > 0) {
        throw new AppError(
          'Cannot delete recipe that is used in active menus',
          409,
          ErrorCodes.RECIPE_IN_USE,
        );
      }

      await prisma.recipe.delete({ where: { id: recipeId } });
      log?.info({ event: 'recipe_deleted', userId, recipeId }, 'Recipe deleted');
    },
  };
}
