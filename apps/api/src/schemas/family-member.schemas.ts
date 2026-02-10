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

export type CreateMemberBody = z.infer<typeof createMemberBodySchema>;
export type UpdateMemberBody = z.infer<typeof updateMemberBodySchema>;
