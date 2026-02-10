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

export type GenerateMenuBody = z.infer<typeof generateMenuBodySchema>;
export type ReplaceMealBody = z.infer<typeof replaceMealBodySchema>;
export type LockMealBody = z.infer<typeof lockMealBodySchema>;
export type MenuHistoryQuery = z.infer<typeof menuHistoryQuerySchema>;
