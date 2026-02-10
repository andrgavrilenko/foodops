import { z } from 'zod';

export const createFamilyBodySchema = z.object({
  name: z.string().min(1).max(100),
  weekly_budget: z.number().positive().max(99999).optional(),
  meals_per_day: z.union([z.literal(2), z.literal(3)]).default(3),
  calorie_target_per_person: z.number().int().positive().max(10000).optional(),
  preferred_store_id: z.string().uuid().optional(),
});

export const updateFamilyBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  weekly_budget: z.number().positive().max(99999).nullable().optional(),
  meals_per_day: z.union([z.literal(2), z.literal(3)]).optional(),
  calorie_target_per_person: z.number().int().positive().max(10000).nullable().optional(),
  preferred_store_id: z.string().uuid().nullable().optional(),
});

export type CreateFamilyBody = z.infer<typeof createFamilyBodySchema>;
export type UpdateFamilyBody = z.infer<typeof updateFamilyBodySchema>;
