import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  createFamilyBodySchema,
  updateFamilyBodySchema,
  familyResponseSchema,
} from '../schemas/family.schemas.js';
import { createFamilyService } from '../services/family.service.js';

const familyRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const familyService = createFamilyService(fastify.prisma);

  // All family routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /family
  fastify.post(
    '/',
    {
      schema: {
        body: createFamilyBodySchema,
        response: { 201: familyResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await familyService.create(request.user.userId, request.body, request.log);
      return reply.status(201).send(result);
    },
  );

  // GET /family
  fastify.get(
    '/',
    { schema: { response: { 200: familyResponseSchema } } },
    async (request, reply) => {
      const result = await familyService.get(request.user.userId);
      return reply.send(result);
    },
  );

  // PATCH /family
  fastify.patch(
    '/',
    {
      schema: {
        body: updateFamilyBodySchema,
        response: { 200: familyResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await familyService.update(request.user.userId, request.body, request.log);
      return reply.send(result);
    },
  );
};

export default familyRoutes;
