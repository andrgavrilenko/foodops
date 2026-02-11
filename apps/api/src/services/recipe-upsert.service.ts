import type { PrismaClient } from '@foodops/db';
import type { AiRecipe } from '../schemas/ai-output.schemas.js';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export async function upsertRecipeFromAiWithClient(
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

export async function upsertRecipeFromAi(
  prisma: PrismaClient,
  aiRecipe: AiRecipe,
): Promise<string> {
  const existing = await prisma.recipe.findFirst({
    where: { titleEn: aiRecipe.title_en, titleFi: aiRecipe.title_fi },
  });
  if (existing) return existing.id;

  return prisma.$transaction(async (tx) => upsertRecipeFromAiWithClient(tx, aiRecipe));
}
