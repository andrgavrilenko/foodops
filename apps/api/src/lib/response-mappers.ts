import type { Prisma } from '@foodops/db';

/** Convert Prisma Decimal to number, or null if input is null */
export function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value ? Number(value) : null;
}

/** Convert Date to ISO date string (YYYY-MM-DD) */
export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

// ── Family ──────────────────────────────────────────────────────────

export function toFamilyResponse(family: {
  id: string;
  name: string;
  weeklyBudget: Prisma.Decimal | null;
  mealsPerDay: number;
  calorieTargetPerPerson: number | null;
  preferredStoreId: string | null;
  createdAt: Date;
  updatedAt: Date;
  members?: Array<{
    id: string;
    name: string;
    age: number;
    role: string;
    createdAt: Date;
    updatedAt: Date;
    dietaryRestrictions?: Array<{
      id: string;
      type: string;
      value: string;
      severity: string;
      createdAt: Date;
    }>;
    medicalRestrictions?: Array<{
      id: string;
      condition: string;
      notes: string | null;
      createdAt: Date;
    }>;
  }>;
  preferences?: Array<{
    id: string;
    type: string;
    value: string;
    createdAt: Date;
  }>;
}) {
  return {
    id: family.id,
    name: family.name,
    weekly_budget: decimalToNumber(family.weeklyBudget),
    meals_per_day: family.mealsPerDay,
    calorie_target_per_person: family.calorieTargetPerPerson,
    preferred_store_id: family.preferredStoreId,
    created_at: family.createdAt.toISOString(),
    updated_at: family.updatedAt.toISOString(),
    members: family.members?.map((m) => ({
      id: m.id,
      name: m.name,
      age: m.age,
      role: m.role,
      created_at: m.createdAt.toISOString(),
      updated_at: m.updatedAt.toISOString(),
      dietary_restrictions: m.dietaryRestrictions?.map((d) => ({
        id: d.id,
        type: d.type,
        value: d.value,
        severity: d.severity,
        created_at: d.createdAt.toISOString(),
      })),
      medical_restrictions: m.medicalRestrictions?.map((mr) => ({
        id: mr.id,
        condition: mr.condition,
        notes: mr.notes,
        created_at: mr.createdAt.toISOString(),
      })),
    })),
    preferences: family.preferences?.map((p) => ({
      id: p.id,
      type: p.type,
      value: p.value,
      created_at: p.createdAt.toISOString(),
    })),
  };
}

// ── Family Member ───────────────────────────────────────────────────

export function toMemberResponse(member: {
  id: string;
  name: string;
  age: number;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: member.id,
    name: member.name,
    age: member.age,
    role: member.role,
    created_at: member.createdAt.toISOString(),
    updated_at: member.updatedAt.toISOString(),
  };
}

// ── Dietary Restriction ─────────────────────────────────────────────

export function toDietaryRestrictionResponse(r: {
  id: string;
  type: string;
  value: string;
  severity: string;
  createdAt: Date;
}) {
  return {
    id: r.id,
    type: r.type,
    value: r.value,
    severity: r.severity,
    created_at: r.createdAt.toISOString(),
  };
}

// ── Medical Restriction ─────────────────────────────────────────────

export function toMedicalRestrictionResponse(r: {
  id: string;
  condition: string;
  notes: string | null;
  createdAt: Date;
}) {
  return {
    id: r.id,
    condition: r.condition,
    notes: r.notes,
    created_at: r.createdAt.toISOString(),
  };
}

// ── Preference ──────────────────────────────────────────────────────

export function toPreferenceResponse(p: {
  id: string;
  type: string;
  value: string;
  createdAt: Date;
}) {
  return {
    id: p.id,
    type: p.type,
    value: p.value,
    created_at: p.createdAt.toISOString(),
  };
}

// ── Recipe ──────────────────────────────────────────────────────────

export function toRecipeResponse(recipe: {
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
    protein_per_serving: decimalToNumber(recipe.proteinPerServing),
    carbs_per_serving: decimalToNumber(recipe.carbsPerServing),
    fat_per_serving: decimalToNumber(recipe.fatPerServing),
    tags: recipe.tags ?? [],
    is_custom: recipe.isCustom,
    user_id: recipe.userId,
    source: recipe.source,
    created_at: recipe.createdAt.toISOString(),
    updated_at: recipe.updatedAt.toISOString(),
  };
}

// ── Alternative Recipe (compact, used in menu alternatives) ─────────

export function toAlternativeRecipeResponse(recipe: {
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
    protein_per_serving: decimalToNumber(recipe.proteinPerServing),
    carbs_per_serving: decimalToNumber(recipe.carbsPerServing),
    fat_per_serving: decimalToNumber(recipe.fatPerServing),
    tags: recipe.tags ?? [],
  };
}

// ── Menu Meal ───────────────────────────────────────────────────────

export function toMealResponse(meal: {
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
      protein_per_serving: decimalToNumber(meal.recipe.proteinPerServing),
      carbs_per_serving: decimalToNumber(meal.recipe.carbsPerServing),
      fat_per_serving: decimalToNumber(meal.recipe.fatPerServing),
      tags: meal.recipe.tags ?? [],
    },
  };
}

// ── Weekly Menu ─────────────────────────────────────────────────────

export function toMenuResponse(menu: {
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
    week_start: toISODate(menu.weekStart),
    status: menu.status,
    total_cost_estimate: decimalToNumber(menu.totalCostEstimate),
    total_calories: menu.totalCalories,
    created_at: menu.createdAt.toISOString(),
    days: menu.menuDays
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((day) => ({
        id: day.id,
        day_of_week: day.dayOfWeek,
        date: toISODate(day.date),
        meals: day.meals.map(toMealResponse),
      })),
  };
}

export function toMenuSummaryResponse(menu: {
  id: string;
  weekStart: Date;
  status: string;
  totalCostEstimate: Prisma.Decimal | null;
  totalCalories: number | null;
  createdAt: Date;
}) {
  return {
    id: menu.id,
    week_start: toISODate(menu.weekStart),
    status: menu.status,
    total_cost_estimate: decimalToNumber(menu.totalCostEstimate),
    total_calories: menu.totalCalories,
    created_at: menu.createdAt.toISOString(),
  };
}
