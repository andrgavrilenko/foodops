import type { PrismaClient } from '@foodops/db';
import type { FamilyContext } from './prompt-builder.js';
import { AppError, ErrorCodes } from './errors.js';

/** Fetch family with members (incl. restrictions) and preferences. Throws if missing or has no members. */
export async function getFullFamily(prisma: PrismaClient, userId: string) {
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

export type FullFamily = Awaited<ReturnType<typeof getFullFamily>>;

/** Build an anonymized FamilyContext for AI prompt from a full family record. */
export function buildFamilyContext(
  family: FullFamily,
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
