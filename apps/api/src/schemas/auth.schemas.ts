import { z } from 'zod';
import { emailSchema, passwordSchema } from './common.js';

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  language: z.string().min(2).max(5).default('en'),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const refreshBodySchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
