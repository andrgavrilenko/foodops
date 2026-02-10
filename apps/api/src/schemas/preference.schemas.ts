import { z } from 'zod';

export const createPreferenceBodySchema = z.object({
  type: z.enum(['CUISINE', 'EXCLUDED_INGREDIENT', 'FAVORITE_RECIPE']),
  value: z.string().min(1).max(255),
});

export type CreatePreferenceBody = z.infer<typeof createPreferenceBodySchema>;
