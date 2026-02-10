import { z } from 'zod';

export const createDietaryRestrictionBodySchema = z.object({
  type: z.enum(['ALLERGY', 'INTOLERANCE', 'LIFESTYLE']),
  value: z.string().min(1).max(100),
  severity: z.enum(['STRICT', 'MODERATE', 'MILD']),
});

export type CreateDietaryRestrictionBody = z.infer<typeof createDietaryRestrictionBodySchema>;
