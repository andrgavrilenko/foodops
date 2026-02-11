import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  registerBodySchema,
  loginBodySchema,
  refreshBodySchema,
  authUserResponseSchema,
  refreshResponseSchema,
} from '../schemas/auth.schemas.js';
import { createAuthService } from '../services/auth.service.js';

const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const authService = createAuthService(fastify.prisma, fastify.jwt, fastify.config);

  // POST /auth/register
  fastify.post(
    '/register',
    {
      schema: {
        body: registerBodySchema,
        response: { 201: authUserResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await authService.register(
        request.body.email,
        request.body.password,
        request.body.language,
        request.log,
      );
      return reply.status(201).send(result);
    },
  );

  // POST /auth/login
  fastify.post(
    '/login',
    {
      schema: {
        body: loginBodySchema,
        response: { 200: authUserResponseSchema },
      },
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const result = await authService.login(request.body.email, request.body.password, request.log);
      return reply.send(result);
    },
  );

  // POST /auth/refresh
  fastify.post(
    '/refresh',
    {
      schema: {
        body: refreshBodySchema,
        response: { 200: refreshResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await authService.refresh(request.body.refresh_token, request.log);
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
      await authService.logout(request.user.userId, request.log);
      return reply.status(204).send();
    },
  );
};

export default authRoutes;
