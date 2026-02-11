import { z } from 'zod';

export const createMemberBodySchema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(150),
  role: z.enum(['ADULT', 'CHILD', 'INFANT']),
});

export const updateMemberBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  age: z.number().int().min(0).max(150).optional(),
  role: z.enum(['ADULT', 'CHILD', 'INFANT']).optional(),
});

// Response schema
export const memberResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  role: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CreateMemberBody = z.infer<typeof createMemberBodySchema>;
export type UpdateMemberBody = z.infer<typeof updateMemberBodySchema>;
