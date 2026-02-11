import type { PrismaClient } from '@foodops/db';
import type { AppConfig } from '../config.js';
import type { AiMenuGenerator } from './ai-menu-generator.js';
import { AppError, ErrorCodes } from '../lib/errors.js';
import { getFamilyIdByUser } from '../lib/ownership.js';
import { parseWeekStart } from '../lib/date-utils.js';
import { getFullFamily, buildFamilyContext } from '../lib/family-context.js';
import {
  toMealResponse,
  toMenuResponse,
  toMenuSummaryResponse,
  toAlternativeRecipeResponse,
} from '../lib/response-mappers.js';
import { upsertRecipeFromAi, upsertRecipeFromAiWithClient } from './recipe-upsert.service.js';
import { LRUCache } from 'lru-cache';
import type { FastifyBaseLogger } from '../lib/logger.js';

const GENERATION_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const GENERATE_RATE_LIMIT = 10; // 10 full generations per hour
const ALTERNATIVES_RATE_LIMIT = 30; // 30 alternatives requests per hour

// NOTE: In-memory rate limiting — lost on restart, not shared across instances.
// Acceptable for single-instance MVP. Migrate to Redis before multi-instance deployment (Phase 5+).
const generateTimestamps = new LRUCache<string, number[]>({
  max: 10_000,
  ttl: GENERATION_RATE_WINDOW_MS,
});
const alternativesTimestamps = new LRUCache<string, number[]>({
  max: 10_000,
  ttl: GENERATION_RATE_WINDOW_MS,
});

function checkRateLimit(
  userId: string,
  cache: LRUCache<string, number[]>,
  limit: number,
  label: string,
) {
  const now = Date.now();
  const timestamps = cache.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < GENERATION_RATE_WINDOW_MS);

  if (recent.length >= limit) {
    throw new AppError(`${label} rate limit exceeded`, 429, ErrorCodes.MENU_GENERATION_RATE_LIMIT);
  }

  recent.push(now);
  cache.set(userId, recent);
}

const menuInclude = {
  menuDays: {
    include: {
      meals: {
        include: { recipe: true },
      },
    },
  },
} as const;

async function verifyMenuOwnership(prisma: PrismaClient, userId: string, menuId: string) {
  const familyId = await getFamilyIdByUser(prisma, userId);

  const menu = await prisma.weeklyMenu.findUnique({
    where: { id: menuId },
    include: menuInclude,
  });

  if (!menu) {
    throw new AppError('Menu not found', 404, ErrorCodes.MENU_NOT_FOUND);
  }
  if (menu.familyId !== familyId) {
    throw new AppError('Menu does not belong to your family', 403, ErrorCodes.MENU_ACCESS_DENIED);
  }

  return { menu, familyId };
}

function findMealInMenu(
  menu: Awaited<ReturnType<typeof verifyMenuOwnership>>['menu'],
  mealId: string,
) {
  const meal = menu.menuDays.flatMap((d) => d.meals).find((m) => m.id === mealId);
  if (!meal) {
    throw new AppError('Meal not found in this menu', 404, ErrorCodes.MEAL_NOT_FOUND);
  }
  return meal;
}

export function createMenuService(
  prisma: PrismaClient,
  config: AppConfig,
  aiGenerator: AiMenuGenerator,
) {
  return {
    async generate(
      userId: string,
      data: {
        week_start?: string;
        locked_meals?: { day: number; meal_type: string; recipe_id: string }[];
      },
      log?: FastifyBaseLogger,
    ) {
      checkRateLimit(userId, generateTimestamps, GENERATE_RATE_LIMIT, 'Menu generation');

      const family = await getFullFamily(prisma, userId);
      const weekStart = parseWeekStart(data.week_start);

      // Resolve locked meals
      const lockedMeals: { day: number; meal_type: string; recipe_title: string }[] = [];
      const lockedMealRecipeIds: Map<string, string> = new Map(); // "day:type" -> recipeId

      if (data.locked_meals?.length) {
        for (const lm of data.locked_meals) {
          const recipe = await prisma.recipe.findUnique({ where: { id: lm.recipe_id } });
          if (recipe) {
            lockedMeals.push({
              day: lm.day,
              meal_type: lm.meal_type,
              recipe_title: recipe.titleEn,
            });
            lockedMealRecipeIds.set(`${lm.day}:${lm.meal_type}`, recipe.id);
          }
        }
      }

      // Build context and generate
      const context = buildFamilyContext(family, lockedMeals);
      log?.info({ event: 'menu_generation_started', userId, familyId: family.id }, 'Menu generation started');
      const startMs = performance.now();
      const aiMenu = await aiGenerator.generateWeeklyMenu(context, log);

      const servings = Math.max(family.members.filter((m) => m.role !== 'INFANT').length, 1);

      const menuId = await prisma.$transaction(async (tx) => {
        // Delete existing DRAFT menu for same week
        await tx.weeklyMenu.deleteMany({
          where: { familyId: family.id, weekStart, status: 'DRAFT' },
        });

        let totalCalories = 0;

        const weeklyMenu = await tx.weeklyMenu.create({
          data: {
            familyId: family.id,
            weekStart,
            status: 'DRAFT',
            totalCostEstimate: aiMenu.total_estimated_cost_eur,
          },
        });

        for (const aiDay of aiMenu.days) {
          const dayDate = new Date(weekStart);
          dayDate.setUTCDate(dayDate.getUTCDate() + aiDay.day_of_week - 1);

          const menuDay = await tx.menuDay.create({
            data: {
              menuId: weeklyMenu.id,
              dayOfWeek: aiDay.day_of_week,
              date: dayDate,
            },
          });

          for (const aiMeal of aiDay.meals) {
            const lockedKey = `${aiDay.day_of_week}:${aiMeal.meal_type}`;
            const lockedRecipeId = lockedMealRecipeIds.get(lockedKey);

            let recipeId: string;
            let isLocked = false;

            if (lockedRecipeId) {
              recipeId = lockedRecipeId;
              isLocked = true;
            } else {
              recipeId = await upsertRecipeFromAiWithClient(tx, aiMeal.recipe);
            }

            totalCalories += aiMeal.recipe.calories_per_serving * servings;

            await tx.meal.create({
              data: {
                menuDayId: menuDay.id,
                mealType: aiMeal.meal_type.toUpperCase() as 'BREAKFAST' | 'LUNCH' | 'DINNER',
                recipeId,
                isLocked,
                servings,
              },
            });
          }
        }

        await tx.weeklyMenu.update({
          where: { id: weeklyMenu.id },
          data: { totalCalories },
        });

        return weeklyMenu.id;
      });

      // Fetch and return full menu
      const fullMenu = await prisma.weeklyMenu.findUniqueOrThrow({
        where: { id: menuId },
        include: menuInclude,
      });

      const durationMs = Math.round(performance.now() - startMs);
      log?.info({ event: 'menu_generation_completed', userId, familyId: family.id, menuId, durationMs }, 'Menu generated');

      return toMenuResponse(fullMenu);
    },

    async getCurrent(userId: string) {
      const familyId = await getFamilyIdByUser(prisma, userId);

      const menu = await prisma.weeklyMenu.findFirst({
        where: { familyId },
        orderBy: { createdAt: 'desc' },
        include: menuInclude,
      });

      if (!menu) {
        throw new AppError('No menus found', 404, ErrorCodes.MENU_NOT_FOUND);
      }

      return toMenuResponse(menu);
    },

    async getById(userId: string, menuId: string) {
      const { menu } = await verifyMenuOwnership(prisma, userId, menuId);
      return toMenuResponse(menu);
    },

    async getHistory(userId: string, query: { page: number; limit: number }) {
      const familyId = await getFamilyIdByUser(prisma, userId);
      const where = { familyId };

      const [menus, total] = await Promise.all([
        prisma.weeklyMenu.findMany({
          where,
          orderBy: { weekStart: 'desc' },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.weeklyMenu.count({ where }),
      ]);

      return {
        data: menus.map(toMenuSummaryResponse),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          total_pages: Math.ceil(total / query.limit),
        },
      };
    },

    async replaceMeal(userId: string, menuId: string, mealId: string, recipeId: string, log?: FastifyBaseLogger) {
      const { menu } = await verifyMenuOwnership(prisma, userId, menuId);

      if (menu.status !== 'DRAFT') {
        throw new AppError('Can only modify draft menus', 400, ErrorCodes.MENU_NOT_DRAFT);
      }

      findMealInMenu(menu, mealId);

      // Verify replacement recipe exists
      const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
      if (!recipe) {
        throw new AppError('Recipe not found', 404, ErrorCodes.RECIPE_NOT_FOUND);
      }

      const updated = await prisma.meal.update({
        where: { id: mealId },
        data: { recipeId },
        include: { recipe: true },
      });

      // Recalculate total calories for the menu
      const allMeals = await prisma.meal.findMany({
        where: { menuDay: { menuId } },
        include: { recipe: true },
      });

      const totalCalories = allMeals.reduce(
        (sum, m) => sum + (m.recipe.caloriesPerServing ?? 0) * m.servings,
        0,
      );

      await prisma.weeklyMenu.update({
        where: { id: menuId },
        data: { totalCalories },
      });

      log?.info({ event: 'meal_replaced', userId, menuId, mealId, recipeId }, 'Meal replaced');

      return toMealResponse(updated);
    },

    async lockMeal(userId: string, menuId: string, mealId: string, isLocked: boolean, log?: FastifyBaseLogger) {
      const { menu } = await verifyMenuOwnership(prisma, userId, menuId);

      if (menu.status !== 'DRAFT') {
        throw new AppError('Can only modify draft menus', 400, ErrorCodes.MENU_NOT_DRAFT);
      }

      findMealInMenu(menu, mealId);

      const updated = await prisma.meal.update({
        where: { id: mealId },
        data: { isLocked },
        include: { recipe: true },
      });

      log?.info({ event: 'meal_locked', userId, menuId, mealId, isLocked }, 'Meal lock toggled');

      return toMealResponse(updated);
    },

    async getAlternatives(userId: string, menuId: string, mealId: string, log?: FastifyBaseLogger) {
      // Load family with full context (for AI prompt) — single DB call
      const family = await getFullFamily(prisma, userId);

      // Verify menu belongs to this family
      const menu = await prisma.weeklyMenu.findUnique({
        where: { id: menuId },
        include: menuInclude,
      });
      if (!menu) {
        throw new AppError('Menu not found', 404, ErrorCodes.MENU_NOT_FOUND);
      }
      if (menu.familyId !== family.id) {
        throw new AppError(
          'Menu does not belong to your family',
          403,
          ErrorCodes.MENU_ACCESS_DENIED,
        );
      }

      checkRateLimit(userId, alternativesTimestamps, ALTERNATIVES_RATE_LIMIT, 'Alternatives');

      log?.info({ event: 'alternatives_requested', userId, menuId, mealId }, 'Alternatives requested');

      const meal = findMealInMenu(menu, mealId);
      const context = buildFamilyContext(family, []);
      const existingTitles = menu.menuDays.flatMap((d) => d.meals).map((m) => m.recipe.titleEn);

      const alternatives = await aiGenerator.generateAlternatives(
        context,
        existingTitles,
        meal.mealType,
        log,
      );

      // Upsert alternative recipes to DB and map to response
      const result = [];
      for (const aiRecipe of alternatives) {
        const recipeId = await upsertRecipeFromAi(prisma, aiRecipe);
        const recipe = await prisma.recipe.findUniqueOrThrow({ where: { id: recipeId } });
        result.push(toAlternativeRecipeResponse(recipe));
      }

      return { alternatives: result };
    },

    async approve(userId: string, menuId: string, log?: FastifyBaseLogger) {
      const { menu, familyId } = await verifyMenuOwnership(prisma, userId, menuId);

      if (menu.status === 'APPROVED') {
        throw new AppError('Menu is already approved', 400, ErrorCodes.MENU_ALREADY_APPROVED);
      }
      if (menu.status === 'ARCHIVED') {
        throw new AppError(
          'Cannot approve an archived menu',
          400,
          ErrorCodes.MENU_ALREADY_ARCHIVED,
        );
      }

      // Archive any previously approved menu
      await prisma.weeklyMenu.updateMany({
        where: { familyId, status: 'APPROVED' },
        data: { status: 'ARCHIVED' },
      });

      const updated = await prisma.weeklyMenu.update({
        where: { id: menuId },
        data: { status: 'APPROVED' },
        include: menuInclude,
      });

      log?.info({ event: 'menu_approved', userId, menuId, familyId }, 'Menu approved');

      return toMenuResponse(updated);
    },
  };
}
