import type { PrismaClient, Prisma } from '@foodops/db';
import type { AppConfig } from '../config.js';
import type { AiMenuGenerator } from './ai-menu-generator.js';
import type { FamilyContext } from '../lib/prompt-builder.js';
import type { AiRecipe } from '../schemas/ai-output.schemas.js';
import { AppError, ErrorCodes } from '../lib/errors.js';
import { LRUCache } from 'lru-cache';

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

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7 || 7;
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() + daysUntilMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function parseWeekStart(dateStr?: string): Date {
  if (!dateStr) return getNextMonday();

  const date = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(date.getTime())) {
    throw new AppError('Invalid date format', 400, ErrorCodes.MENU_INVALID_WEEK_START);
  }

  // Must be a Monday (0=Sun, 1=Mon, ...)
  if (date.getUTCDay() !== 1) {
    throw new AppError('week_start must be a Monday', 400, ErrorCodes.MENU_INVALID_WEEK_START);
  }

  return date;
}

function toMealResponse(meal: {
  id: string;
  mealType: string;
  isLocked: boolean;
  servings: number;
  recipe: {
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
  };
}) {
  return {
    id: meal.id,
    meal_type: meal.mealType,
    is_locked: meal.isLocked,
    servings: meal.servings,
    recipe: {
      id: meal.recipe.id,
      title_en: meal.recipe.titleEn,
      title_fi: meal.recipe.titleFi,
      description_en: meal.recipe.descriptionEn,
      description_fi: meal.recipe.descriptionFi,
      cuisine_type: meal.recipe.cuisineType,
      prep_time_min: meal.recipe.prepTimeMin,
      calories_per_serving: meal.recipe.caloriesPerServing,
      protein_per_serving: meal.recipe.proteinPerServing
        ? Number(meal.recipe.proteinPerServing)
        : null,
      carbs_per_serving: meal.recipe.carbsPerServing ? Number(meal.recipe.carbsPerServing) : null,
      fat_per_serving: meal.recipe.fatPerServing ? Number(meal.recipe.fatPerServing) : null,
      tags: meal.recipe.tags ?? [],
    },
  };
}

function toMenuResponse(menu: {
  id: string;
  familyId: string;
  weekStart: Date;
  status: string;
  totalCostEstimate: Prisma.Decimal | null;
  totalCalories: number | null;
  createdAt: Date;
  menuDays: Array<{
    id: string;
    dayOfWeek: number;
    date: Date;
    meals: Array<Parameters<typeof toMealResponse>[0]>;
  }>;
}) {
  return {
    id: menu.id,
    family_id: menu.familyId,
    week_start: menu.weekStart.toISOString().split('T')[0],
    status: menu.status,
    total_cost_estimate: menu.totalCostEstimate ? Number(menu.totalCostEstimate) : null,
    total_calories: menu.totalCalories,
    created_at: menu.createdAt.toISOString(),
    days: menu.menuDays
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((day) => ({
        id: day.id,
        day_of_week: day.dayOfWeek,
        date: day.date.toISOString().split('T')[0],
        meals: day.meals.map(toMealResponse),
      })),
  };
}

function toMenuSummaryResponse(menu: {
  id: string;
  weekStart: Date;
  status: string;
  totalCostEstimate: Prisma.Decimal | null;
  totalCalories: number | null;
  createdAt: Date;
}) {
  return {
    id: menu.id,
    week_start: menu.weekStart.toISOString().split('T')[0],
    status: menu.status,
    total_cost_estimate: menu.totalCostEstimate ? Number(menu.totalCostEstimate) : null,
    total_calories: menu.totalCalories,
    created_at: menu.createdAt.toISOString(),
  };
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

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

async function upsertRecipeFromAiWithClient(
  tx: PrismaTransactionClient,
  aiRecipe: AiRecipe,
): Promise<string> {
  // Try to find by exact title match
  const existing = await tx.recipe.findFirst({
    where: { titleEn: aiRecipe.title_en, titleFi: aiRecipe.title_fi },
  });
  if (existing) return existing.id;

  const recipe = await tx.recipe.create({
    data: {
      titleEn: aiRecipe.title_en,
      titleFi: aiRecipe.title_fi,
      descriptionEn: aiRecipe.description_en || null,
      descriptionFi: aiRecipe.description_fi || null,
      cuisineType: aiRecipe.cuisine_type || null,
      prepTimeMin: aiRecipe.prep_time_min,
      caloriesPerServing: aiRecipe.calories_per_serving,
      proteinPerServing: aiRecipe.protein_per_serving,
      carbsPerServing: aiRecipe.carbs_per_serving,
      fatPerServing: aiRecipe.fat_per_serving,
      tags: aiRecipe.tags,
      isCustom: false,
    },
  });

  // Batch lookup: find all existing ingredients in one query
  const ingredientNames = aiRecipe.ingredients.map((ing) => ing.name_en);
  const existingIngredients = await tx.ingredient.findMany({
    where: { nameEn: { in: ingredientNames } },
  });
  const ingredientMap = new Map(existingIngredients.map((ing) => [ing.nameEn, ing]));

  // Create missing ingredients
  for (const ing of aiRecipe.ingredients) {
    if (!ingredientMap.has(ing.name_en)) {
      const created = await tx.ingredient.create({
        data: {
          nameEn: ing.name_en,
          nameFi: ing.name_fi,
          category: ing.category,
          defaultUnit: ing.unit,
        },
      });
      ingredientMap.set(ing.name_en, created);
    }
  }

  // Batch create all recipe-ingredient links
  await tx.recipeIngredient.createMany({
    data: aiRecipe.ingredients.map((ing) => ({
      recipeId: recipe.id,
      ingredientId: ingredientMap.get(ing.name_en)!.id,
      quantity: ing.quantity,
      unit: ing.unit,
      isOptional: ing.is_optional,
    })),
  });

  return recipe.id;
}

async function upsertRecipeFromAi(prisma: PrismaClient, aiRecipe: AiRecipe): Promise<string> {
  const existing = await prisma.recipe.findFirst({
    where: { titleEn: aiRecipe.title_en, titleFi: aiRecipe.title_fi },
  });
  if (existing) return existing.id;

  return prisma.$transaction(async (tx) => upsertRecipeFromAiWithClient(tx, aiRecipe));
}

export function createMenuService(
  prisma: PrismaClient,
  config: AppConfig,
  aiGenerator: AiMenuGenerator,
) {
  async function getFamily(userId: string) {
    const family = await prisma.family.findUnique({
      where: { userId },
      include: {
        members: {
          include: {
            dietaryRestrictions: true,
            medicalRestrictions: true,
          },
        },
        preferences: true,
      },
    });

    if (!family) {
      throw new AppError('Family not found', 404, ErrorCodes.MENU_FAMILY_NOT_FOUND);
    }
    if (family.members.length === 0) {
      throw new AppError(
        'Family has no members. Add at least one member before generating a menu.',
        400,
        ErrorCodes.MENU_FAMILY_INCOMPLETE,
      );
    }

    return family;
  }

  async function getFamilyId(userId: string) {
    const family = await prisma.family.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!family) {
      throw new AppError('Family not found', 404, ErrorCodes.MENU_FAMILY_NOT_FOUND);
    }
    return family.id;
  }

  async function verifyMenuOwnership(userId: string, menuId: string) {
    const familyId = await getFamilyId(userId);

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

  function buildFamilyContext(
    family: Awaited<ReturnType<typeof getFamily>>,
    lockedMeals: { day: number; meal_type: string; recipe_title: string }[],
  ): FamilyContext {
    const servings = family.members.filter((m) => m.role !== 'INFANT').length;

    const dietary_restrictions: FamilyContext['dietary_restrictions'] = [];
    const medical_restrictions: FamilyContext['medical_restrictions'] = [];

    family.members.forEach((m, i) => {
      const label = `Member ${i + 1} (${m.role.toLowerCase()}, ${m.age})`;
      for (const dr of m.dietaryRestrictions) {
        dietary_restrictions.push({
          member_label: label,
          type: dr.type.toLowerCase(),
          value: dr.value,
          severity: dr.severity.toLowerCase(),
        });
      }
      for (const mr of m.medicalRestrictions) {
        medical_restrictions.push({
          member_label: label,
          condition: mr.condition,
        });
      }
    });

    const cuisines: string[] = [];
    const excluded_ingredients: string[] = [];

    for (const p of family.preferences) {
      if (p.type === 'CUISINE') cuisines.push(p.value);
      if (p.type === 'EXCLUDED_INGREDIENT') excluded_ingredients.push(p.value);
    }

    return {
      members: family.members.map((m) => ({ role: m.role.toLowerCase(), age: m.age })),
      servings: Math.max(servings, 1),
      meals_per_day: family.mealsPerDay,
      dietary_restrictions,
      medical_restrictions,
      cuisines,
      excluded_ingredients,
      weekly_budget_eur: family.weeklyBudget ? Number(family.weeklyBudget) : null,
      calorie_target_per_person: family.calorieTargetPerPerson,
      locked_meals: lockedMeals,
    };
  }

  return {
    async generate(
      userId: string,
      data: {
        week_start?: string;
        locked_meals?: { day: number; meal_type: string; recipe_id: string }[];
      },
    ) {
      checkRateLimit(userId, generateTimestamps, GENERATE_RATE_LIMIT, 'Menu generation');

      const family = await getFamily(userId);
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
      const aiMenu = await aiGenerator.generateWeeklyMenu(context);

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

      return toMenuResponse(fullMenu);
    },

    async getCurrent(userId: string) {
      const familyId = await getFamilyId(userId);

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
      const { menu } = await verifyMenuOwnership(userId, menuId);
      return toMenuResponse(menu);
    },

    async getHistory(userId: string, query: { page: number; limit: number }) {
      const familyId = await getFamilyId(userId);
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

    async replaceMeal(userId: string, menuId: string, mealId: string, recipeId: string) {
      const { menu } = await verifyMenuOwnership(userId, menuId);

      if (menu.status !== 'DRAFT') {
        throw new AppError('Can only modify draft menus', 400, ErrorCodes.MENU_NOT_DRAFT);
      }

      // Find the meal in this menu
      const meal = menu.menuDays.flatMap((d) => d.meals).find((m) => m.id === mealId);
      if (!meal) {
        throw new AppError('Meal not found in this menu', 404, ErrorCodes.MEAL_NOT_FOUND);
      }

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

      return toMealResponse(updated);
    },

    async lockMeal(userId: string, menuId: string, mealId: string, isLocked: boolean) {
      const { menu } = await verifyMenuOwnership(userId, menuId);

      if (menu.status !== 'DRAFT') {
        throw new AppError('Can only modify draft menus', 400, ErrorCodes.MENU_NOT_DRAFT);
      }

      const meal = menu.menuDays.flatMap((d) => d.meals).find((m) => m.id === mealId);
      if (!meal) {
        throw new AppError('Meal not found in this menu', 404, ErrorCodes.MEAL_NOT_FOUND);
      }

      const updated = await prisma.meal.update({
        where: { id: mealId },
        data: { isLocked },
        include: { recipe: true },
      });

      return toMealResponse(updated);
    },

    async getAlternatives(userId: string, menuId: string, mealId: string) {
      // Load family with full context (for AI prompt) — single DB call
      const family = await getFamily(userId);

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

      const meal = menu.menuDays.flatMap((d) => d.meals).find((m) => m.id === mealId);
      if (!meal) {
        throw new AppError('Meal not found in this menu', 404, ErrorCodes.MEAL_NOT_FOUND);
      }

      const context = buildFamilyContext(family, []);

      const existingTitles = menu.menuDays.flatMap((d) => d.meals).map((m) => m.recipe.titleEn);

      const alternatives = await aiGenerator.generateAlternatives(
        context,
        existingTitles,
        meal.mealType,
      );

      // Upsert alternative recipes to DB
      const result: Array<ReturnType<typeof toMealResponse>['recipe']> = [];
      for (const aiRecipe of alternatives) {
        const recipeId = await upsertRecipeFromAi(prisma, aiRecipe);
        const recipe = await prisma.recipe.findUniqueOrThrow({ where: { id: recipeId } });
        result.push({
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
        });
      }

      return { alternatives: result };
    },

    async approve(userId: string, menuId: string) {
      const { menu, familyId } = await verifyMenuOwnership(userId, menuId);

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

      return toMenuResponse(updated);
    },
  };
}
