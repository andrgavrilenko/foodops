import { z } from 'zod';

export const emailSchema = z.string().email().max(255).toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const uuidSchema = z.string().uuid();

// Reusable param schemas for routes with :id
export const idParamSchema = z.object({ id: z.string().uuid() });
export const memberIdParamSchema = z.object({ memberId: z.string().uuid() });
export const memberIdAndIdParamSchema = z.object({
  memberId: z.string().uuid(),
  id: z.string().uuid(),
});
export const menuMealParamSchema = z.object({
  menuId: z.string().uuid(),
  mealId: z.string().uuid(),
});

// Shared error response schema for Swagger
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  statusCode: z.number(),
});
