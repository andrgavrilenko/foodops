import { z } from 'zod';

export const generateMenuBodySchema = z.object({
  week_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .optional(),
  locked_meals: z
    .array(
      z.object({
        day: z.number().int().min(1).max(7),
        meal_type: z.enum(['breakfast', 'lunch', 'dinner']),
        recipe_id: z.string().uuid(),
      }),
    )
    .optional()
    .default([]),
});

export const replaceMealBodySchema = z.object({
  recipe_id: z.string().uuid(),
});

export const lockMealBodySchema = z.object({
  is_locked: z.boolean(),
});

export const menuHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

// Response schemas (permissive — describe shape for Swagger, not validate output)
const mealRecipeResponseSchema = z.object({
  id: z.string(),
  title_en: z.string(),
  title_fi: z.string(),
  description_en: z.string().nullable(),
  description_fi: z.string().nullable(),
  cuisine_type: z.string().nullable(),
  prep_time_min: z.number().nullable(),
  calories_per_serving: z.number().nullable(),
  protein_per_serving: z.number().nullable(),
  carbs_per_serving: z.number().nullable(),
  fat_per_serving: z.number().nullable(),
  tags: z.unknown(),
});

export const mealResponseSchema = z.object({
  id: z.string(),
  meal_type: z.string(),
  is_locked: z.boolean(),
  servings: z.number(),
  recipe: mealRecipeResponseSchema,
});

const menuDayResponseSchema = z.object({
  id: z.string(),
  day_of_week: z.number(),
  date: z.string(),
  meals: z.array(mealResponseSchema),
});

export const menuResponseSchema = z.object({
  id: z.string(),
  family_id: z.string(),
  week_start: z.string(),
  status: z.string(),
  total_cost_estimate: z.number().nullable(),
  total_calories: z.number().nullable(),
  created_at: z.string(),
  days: z.array(menuDayResponseSchema),
});

const menuSummaryResponseSchema = z.object({
  id: z.string(),
  week_start: z.string(),
  status: z.string(),
  total_cost_estimate: z.number().nullable(),
  total_calories: z.number().nullable(),
  created_at: z.string(),
});

const paginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  total_pages: z.number(),
});

export const menuHistoryResponseSchema = z.object({
  data: z.array(menuSummaryResponseSchema),
  pagination: paginationSchema,
});

export const alternativesResponseSchema = z.object({
  alternatives: z.array(mealRecipeResponseSchema),
});

export type GenerateMenuBody = z.infer<typeof generateMenuBodySchema>;
export type ReplaceMealBody = z.infer<typeof replaceMealBodySchema>;
export type LockMealBody = z.infer<typeof lockMealBodySchema>;
export type MenuHistoryQuery = z.infer<typeof menuHistoryQuerySchema>;
