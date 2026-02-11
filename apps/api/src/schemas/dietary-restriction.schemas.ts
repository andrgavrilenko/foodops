import { z } from 'zod';

export const createDietaryRestrictionBodySchema = z.object({
  type: z.enum(['ALLERGY', 'INTOLERANCE', 'LIFESTYLE']),
  value: z.string().min(1).max(100),
  severity: z.enum(['STRICT', 'MODERATE', 'MILD']),
});

// Response schema
export const dietaryRestrictionResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  value: z.string(),
  severity: z.string(),
  created_at: z.string(),
});

export type CreateDietaryRestrictionBody = z.infer<typeof createDietaryRestrictionBodySchema>;
