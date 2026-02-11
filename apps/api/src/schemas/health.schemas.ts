import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  version: z.string(),
  uptime: z.number(),
});

export const healthDbResponseSchema = z.object({
  status: z.string(),
  responseTimeMs: z.number(),
  message: z.string().optional(),
});

const healthCheckSchema = z.object({
  status: z.string(),
  responseTimeMs: z.number().optional(),
});

export const healthReadyResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  checks: z.record(healthCheckSchema),
});
