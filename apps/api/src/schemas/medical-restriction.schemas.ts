import { z } from 'zod';

export const createMedicalRestrictionBodySchema = z.object({
  condition: z.string().min(1).max(100),
  notes: z.string().max(500).nullable().optional(),
});

export type CreateMedicalRestrictionBody = z.infer<typeof createMedicalRestrictionBodySchema>;
