import { createRequire } from 'node:module';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  healthResponseSchema,
  healthDbResponseSchema,
  healthReadyResponseSchema,
} from '../schemas/health.schemas.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };
const APP_VERSION = pkg.version;

const healthRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // GET /health — basic health check
  fastify.get(
    '/',
    { schema: { response: { 200: healthResponseSchema } } },
    async (_request, reply) => {
      return reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: APP_VERSION,
        uptime: process.uptime(),
      });
    },
  );

  // GET /health/db — database health check
  fastify.get(
    '/db',
    { schema: { response: { 200: healthDbResponseSchema, 503: healthDbResponseSchema } } },
    async (_request, reply) => {
      const start = performance.now();

      try {
        await fastify.prisma.$queryRaw`SELECT 1`;
        const responseTimeMs = Math.round((performance.now() - start) * 100) / 100;

        return reply.send({
          status: 'ok',
          responseTimeMs,
        });
      } catch (error) {
        const responseTimeMs = Math.round((performance.now() - start) * 100) / 100;
        fastify.log.error(error, 'Database health check failed');

        return reply.status(503).send({
          status: 'error',
          responseTimeMs,
          message: 'Database connection failed',
        });
      }
    },
  );

  // GET /health/ready — readiness check (app + database)
  fastify.get(
    '/ready',
    {
      schema: {
        response: { 200: healthReadyResponseSchema, 503: healthReadyResponseSchema },
      },
    },
    async (_request, reply) => {
      const checks: Record<string, { status: string; responseTimeMs?: number }> = {};

      // App check — always ok if we got here
      checks['app'] = { status: 'ok' };

      // Database check
      const dbStart = performance.now();
      try {
        await fastify.prisma.$queryRaw`SELECT 1`;
        const dbTime = Math.round((performance.now() - dbStart) * 100) / 100;
        checks['database'] = { status: 'ok', responseTimeMs: dbTime };
      } catch {
        const dbTime = Math.round((performance.now() - dbStart) * 100) / 100;
        checks['database'] = { status: 'error', responseTimeMs: dbTime };
      }

      const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

      return reply.status(allHealthy ? 200 : 503).send({
        status: allHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        checks,
      });
    },
  );
};

export default healthRoutes;
