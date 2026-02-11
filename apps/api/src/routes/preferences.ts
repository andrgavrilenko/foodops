import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  createPreferenceBodySchema,
  preferenceResponseSchema,
} from '../schemas/preference.schemas.js';
import { createPreferenceService } from '../services/preference.service.js';
import { idParamSchema } from '../schemas/common.js';

const preferenceRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const service = createPreferenceService(fastify.prisma);

  fastify.addHook('preHandler', fastify.authenticate);

  // POST /family/preferences
  fastify.post(
    '/',
    {
      schema: {
        body: createPreferenceBodySchema,
        response: { 201: preferenceResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await service.create(request.user.userId, request.body, request.log);
      return reply.status(201).send(result);
    },
  );

  // GET /family/preferences
  fastify.get(
    '/',
    { schema: { response: { 200: preferenceResponseSchema.array() } } },
    async (request, reply) => {
      const result = await service.list(request.user.userId);
      return reply.send(result);
    },
  );

  // DELETE /family/preferences/:id
  fastify.delete(
    '/:id',
    { schema: { params: idParamSchema } },
    async (request, reply) => {
      await service.delete(request.user.userId, request.params.id, request.log);
      return reply.status(204).send();
    },
  );
};

export default preferenceRoutes;
