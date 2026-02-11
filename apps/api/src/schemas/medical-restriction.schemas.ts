import { z } from 'zod';

export const createMedicalRestrictionBodySchema = z.object({
  condition: z.string().min(1).max(100),
  notes: z.string().max(500).nullable().optional(),
});

// Response schema
export const medicalRestrictionResponseSchema = z.object({
  id: z.string(),
  condition: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

export type CreateMedicalRestrictionBody = z.infer<typeof createMedicalRestrictionBodySchema>;
