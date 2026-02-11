import { z } from 'zod';

export const createPreferenceBodySchema = z.object({
  type: z.enum(['CUISINE', 'EXCLUDED_INGREDIENT', 'FAVORITE_RECIPE']),
  value: z.string().min(1).max(255),
});

// Response schema
export const preferenceResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  value: z.string(),
  created_at: z.string(),
});

export type CreatePreferenceBody = z.infer<typeof createPreferenceBodySchema>;
