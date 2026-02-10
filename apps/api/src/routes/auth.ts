import type { FastifyPluginAsync } from 'fastify';
import { registerBodySchema, loginBodySchema, refreshBodySchema } from '../schemas/auth.schemas.js';
import { createAuthService } from '../services/auth.service.js';
import { zodToFastify } from '../lib/schema-utils.js';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const authService = createAuthService(fastify.prisma, fastify.jwt, fastify.config);

  // POST /auth/register
  fastify.post(
    '/register',
    { schema: { body: zodToFastify(registerBodySchema) } },
    async (request, reply) => {
      const body = registerBodySchema.parse(request.body);
      const result = await authService.register(body.email, body.password, body.language);
      return reply.status(201).send(result);
    },
  );

  // POST /auth/login
  fastify.post(
    '/login',
    {
      schema: { body: zodToFastify(loginBodySchema) },
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const body = loginBodySchema.parse(request.body);
      const result = await authService.login(body.email, body.password);
      return reply.send(result);
    },
  );

  // POST /auth/refresh
  fastify.post(
    '/refresh',
    { schema: { body: zodToFastify(refreshBodySchema) } },
    async (request, reply) => {
      const body = refreshBodySchema.parse(request.body);
      const result = await authService.refresh(body.refresh_token);
      return reply.send(result);
    },
  );

  // POST /auth/logout
  fastify.post(
    '/logout',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      await authService.logout(request.user.userId);
      return reply.status(204).send();
    },
  );
};

export default authRoutes;
