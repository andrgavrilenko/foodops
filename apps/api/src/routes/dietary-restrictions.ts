import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  createDietaryRestrictionBodySchema,
  dietaryRestrictionResponseSchema,
} from '../schemas/dietary-restriction.schemas.js';
import { createDietaryRestrictionService } from '../services/dietary-restriction.service.js';
import { memberIdParamSchema, memberIdAndIdParamSchema } from '../schemas/common.js';

const dietaryRestrictionRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const service = createDietaryRestrictionService(fastify.prisma);

  fastify.addHook('preHandler', fastify.authenticate);

  // POST /family/members/:memberId/dietary-restrictions
  fastify.post(
    '/:memberId/dietary-restrictions',
    {
      schema: {
        params: memberIdParamSchema,
        body: createDietaryRestrictionBodySchema,
        response: { 201: dietaryRestrictionResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await service.create(
        request.user.userId,
        request.params.memberId,
        request.body,
        request.log,
      );
      return reply.status(201).send(result);
    },
  );

  // DELETE /family/members/:memberId/dietary-restrictions/:id
  fastify.delete(
    '/:memberId/dietary-restrictions/:id',
    { schema: { params: memberIdAndIdParamSchema } },
    async (request, reply) => {
      await service.delete(request.user.userId, request.params.memberId, request.params.id, request.log);
      return reply.status(204).send();
    },
  );
};

export default dietaryRestrictionRoutes;
