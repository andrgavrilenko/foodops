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

// Response schemas
const dietaryRestrictionResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  value: z.string(),
  severity: z.string(),
  created_at: z.string(),
});

const medicalRestrictionResponseSchema = z.object({
  id: z.string(),
  condition: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

const memberResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  role: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  dietary_restrictions: z.array(dietaryRestrictionResponseSchema).optional(),
  medical_restrictions: z.array(medicalRestrictionResponseSchema).optional(),
});

const preferenceResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  value: z.string(),
  created_at: z.string(),
});

export const familyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  weekly_budget: z.number().nullable(),
  meals_per_day: z.number(),
  calorie_target_per_person: z.number().nullable(),
  preferred_store_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  members: z.array(memberResponseSchema).optional(),
  preferences: z.array(preferenceResponseSchema).optional(),
});

export type CreateFamilyBody = z.infer<typeof createFamilyBodySchema>;
export type UpdateFamilyBody = z.infer<typeof updateFamilyBodySchema>;
