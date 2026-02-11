import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  createMedicalRestrictionBodySchema,
  medicalRestrictionResponseSchema,
} from '../schemas/medical-restriction.schemas.js';
import { createMedicalRestrictionService } from '../services/medical-restriction.service.js';
import { memberIdParamSchema, memberIdAndIdParamSchema } from '../schemas/common.js';

const medicalRestrictionRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const service = createMedicalRestrictionService(fastify.prisma);

  fastify.addHook('preHandler', fastify.authenticate);

  // POST /family/members/:memberId/medical-restrictions
  fastify.post(
    '/:memberId/medical-restrictions',
    {
      schema: {
        params: memberIdParamSchema,
        body: createMedicalRestrictionBodySchema,
        response: { 201: medicalRestrictionResponseSchema },
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

  // DELETE /family/members/:memberId/medical-restrictions/:id
  fastify.delete(
    '/:memberId/medical-restrictions/:id',
    { schema: { params: memberIdAndIdParamSchema } },
    async (request, reply) => {
      await service.delete(request.user.userId, request.params.memberId, request.params.id, request.log);
      return reply.status(204).send();
    },
  );
};

export default medicalRestrictionRoutes;
