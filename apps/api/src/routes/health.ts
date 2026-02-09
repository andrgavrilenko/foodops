import type { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /health — basic health check
  fastify.get('/', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.0.1',
      uptime: process.uptime(),
    });
  });

  // GET /health/db — database health check
  fastify.get('/db', async (_request, reply) => {
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
  });

  // GET /health/ready — readiness check (app + database)
  fastify.get('/ready', async (_request, reply) => {
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
  });
};

export default healthRoutes;
