import type { AiMenuResponse } from '../schemas/ai-output.schemas.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that no recipe contains ingredients matching STRICT dietary restrictions.
 */
export function validateRestrictionCompliance(
  menu: AiMenuResponse,
  strictRestrictions: { value: string }[],
): ValidationResult {
  if (strictRestrictions.length === 0) return { valid: true, errors: [] };

  const forbiddenPatterns = strictRestrictions.map((r) => ({
    value: r.value,
    regex: new RegExp(`\\b${r.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
  }));
  const errors: string[] = [];

  for (const day of menu.days) {
    for (const meal of day.meals) {
      for (const ingredient of meal.recipe.ingredients) {
        for (const f of forbiddenPatterns) {
          if (f.regex.test(ingredient.name_en) || f.regex.test(ingredient.name_fi)) {
            errors.push(
              `Day ${day.day_of_week} ${meal.meal_type}: "${meal.recipe.title_en}" contains forbidden ingredient "${ingredient.name_en}" (matches restriction "${f.value}")`,
            );
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates that no two recipes share the same title within the week.
 */
export function validateUniqueness(menu: AiMenuResponse): ValidationResult {
  const titles = new Set<string>();
  const duplicates: string[] = [];

  for (const day of menu.days) {
    for (const meal of day.meals) {
      const key = meal.recipe.title_en.toLowerCase();
      if (titles.has(key)) {
        duplicates.push(
          `Day ${day.day_of_week} ${meal.meal_type}: duplicate recipe "${meal.recipe.title_en}"`,
        );
      }
      titles.add(key);
    }
  }

  return { valid: duplicates.length === 0, errors: duplicates };
}

/**
 * Validates that every recipe has minimum required fields filled.
 */
export function validateCompleteness(menu: AiMenuResponse): ValidationResult {
  const errors: string[] = [];

  for (const day of menu.days) {
    for (const meal of day.meals) {
      const r = meal.recipe;
      if (!r.title_en || !r.title_fi) {
        errors.push(`Day ${day.day_of_week} ${meal.meal_type}: missing title_en or title_fi`);
      }
      if (r.ingredients.length < 2) {
        errors.push(
          `Day ${day.day_of_week} ${meal.meal_type}: "${r.title_en}" has fewer than 2 ingredients`,
        );
      }
      if (r.calories_per_serving <= 0) {
        errors.push(
          `Day ${day.day_of_week} ${meal.meal_type}: "${r.title_en}" has invalid calories`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates the correct number of meals per day.
 */
export function validateMealCount(
  menu: AiMenuResponse,
  expectedMealsPerDay: number,
): ValidationResult {
  const errors: string[] = [];

  for (const day of menu.days) {
    if (day.meals.length !== expectedMealsPerDay) {
      errors.push(
        `Day ${day.day_of_week}: expected ${expectedMealsPerDay} meals, got ${day.meals.length}`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
