import { z } from 'zod';

export const createRecipeBodySchema = z.object({
  title_en: z.string().min(1).max(255),
  title_fi: z.string().min(1).max(255),
  description_en: z.string().max(5000).nullable().optional(),
  description_fi: z.string().max(5000).nullable().optional(),
  cuisine_type: z.string().max(50).nullable().optional(),
  prep_time_min: z.number().int().positive().max(32767).nullable().optional(),
  calories_per_serving: z.number().int().positive().max(32767).nullable().optional(),
  protein_per_serving: z.number().positive().max(9999).nullable().optional(),
  carbs_per_serving: z.number().positive().max(9999).nullable().optional(),
  fat_per_serving: z.number().positive().max(9999).nullable().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().max(500).nullable().optional(),
});

export const updateRecipeBodySchema = z.object({
  title_en: z.string().min(1).max(255).optional(),
  title_fi: z.string().min(1).max(255).optional(),
  description_en: z.string().max(5000).nullable().optional(),
  description_fi: z.string().max(5000).nullable().optional(),
  cuisine_type: z.string().max(50).nullable().optional(),
  prep_time_min: z.number().int().positive().max(32767).nullable().optional(),
  calories_per_serving: z.number().int().positive().max(32767).nullable().optional(),
  protein_per_serving: z.number().positive().max(9999).nullable().optional(),
  carbs_per_serving: z.number().positive().max(9999).nullable().optional(),
  fat_per_serving: z.number().positive().max(9999).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  source: z.string().max(500).nullable().optional(),
});

export const listRecipesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cuisine_type: z.string().max(50).optional(),
});

export type CreateRecipeBody = z.infer<typeof createRecipeBodySchema>;
export type UpdateRecipeBody = z.infer<typeof updateRecipeBodySchema>;
export type ListRecipesQuery = z.infer<typeof listRecipesQuerySchema>;
