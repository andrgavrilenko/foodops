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

// Response schemas (permissive — describe shape for Swagger, not validate output)
export const authUserResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    language: z.string(),
    created_at: z.string(),
  }),
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

export const refreshResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
