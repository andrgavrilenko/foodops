import type { PrismaClient, Prisma } from '@foodops/db';
import { AppError, ErrorCodes } from '../lib/errors.js';

function toRecipeResponse(recipe: {
  id: string;
  titleEn: string;
  titleFi: string;
  descriptionEn: string | null;
  descriptionFi: string | null;
  cuisineType: string | null;
  prepTimeMin: number | null;
  caloriesPerServing: number | null;
  proteinPerServing: Prisma.Decimal | null;
  carbsPerServing: Prisma.Decimal | null;
  fatPerServing: Prisma.Decimal | null;
  tags: Prisma.JsonValue;
  isCustom: boolean;
  userId: string | null;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: recipe.id,
    title_en: recipe.titleEn,
    title_fi: recipe.titleFi,
    description_en: recipe.descriptionEn,
    description_fi: recipe.descriptionFi,
    cuisine_type: recipe.cuisineType,
    prep_time_min: recipe.prepTimeMin,
    calories_per_serving: recipe.caloriesPerServing,
    protein_per_serving: recipe.proteinPerServing ? Number(recipe.proteinPerServing) : null,
    carbs_per_serving: recipe.carbsPerServing ? Number(recipe.carbsPerServing) : null,
    fat_per_serving: recipe.fatPerServing ? Number(recipe.fatPerServing) : null,
    tags: recipe.tags ?? [],
    is_custom: recipe.isCustom,
    user_id: recipe.userId,
    source: recipe.source,
    created_at: recipe.createdAt.toISOString(),
    updated_at: recipe.updatedAt.toISOString(),
  };
}

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

    async list(query: { page: number; limit: number; cuisine_type?: string }) {
      const where: Prisma.RecipeWhereInput = {};
      if (query.cuisine_type) {
        where.cuisineType = query.cuisine_type;
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
      return toRecipeResponse(updated);
    },

    async delete(userId: string, recipeId: string) {
      const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
      if (!recipe) {
        throw new AppError('Recipe not found', 404, ErrorCodes.RECIPE_NOT_FOUND);
      }
      if (recipe.userId !== userId) {
        throw new AppError('Not the recipe owner', 403, ErrorCodes.RECIPE_NOT_OWNER);
      }

      await prisma.recipe.delete({ where: { id: recipeId } });
    },
  };
}
