import type { FastifyPluginAsync } from 'fastify';
import { createMedicalRestrictionBodySchema } from '../schemas/medical-restriction.schemas.js';
import { createMedicalRestrictionService } from '../services/medical-restriction.service.js';
import { uuidSchema } from '../schemas/common.js';

const medicalRestrictionRoutes: FastifyPluginAsync = async (fastify) => {
  const service = createMedicalRestrictionService(fastify.prisma);

  fastify.addHook('preHandler', fastify.authenticate);

  // POST /family/members/:memberId/medical-restrictions
  fastify.post('/:memberId/medical-restrictions', async (request, reply) => {
    const { memberId } = request.params as { memberId: string };
    uuidSchema.parse(memberId);
    const body = createMedicalRestrictionBodySchema.parse(request.body);
    const result = await service.create(request.user.userId, memberId, body);
    return reply.status(201).send(result);
  });

  // DELETE /family/members/:memberId/medical-restrictions/:id
  fastify.delete('/:memberId/medical-restrictions/:id', async (request, reply) => {
    const { memberId, id } = request.params as { memberId: string; id: string };
    uuidSchema.parse(memberId);
    uuidSchema.parse(id);
    await service.delete(request.user.userId, memberId, id);
    return reply.status(204).send();
  });
};

export default medicalRestrictionRoutes;
