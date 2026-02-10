import type { FastifyPluginAsync } from 'fastify';
import { createDietaryRestrictionBodySchema } from '../schemas/dietary-restriction.schemas.js';
import { createDietaryRestrictionService } from '../services/dietary-restriction.service.js';
import { uuidSchema } from '../schemas/common.js';

const dietaryRestrictionRoutes: FastifyPluginAsync = async (fastify) => {
  const service = createDietaryRestrictionService(fastify.prisma);

  fastify.addHook('preHandler', fastify.authenticate);

  // POST /family/members/:memberId/dietary-restrictions
  fastify.post('/:memberId/dietary-restrictions', async (request, reply) => {
    const { memberId } = request.params as { memberId: string };
    uuidSchema.parse(memberId);
    const body = createDietaryRestrictionBodySchema.parse(request.body);
    const result = await service.create(request.user.userId, memberId, body);
    return reply.status(201).send(result);
  });

  // DELETE /family/members/:memberId/dietary-restrictions/:id
  fastify.delete('/:memberId/dietary-restrictions/:id', async (request, reply) => {
    const { memberId, id } = request.params as { memberId: string; id: string };
    uuidSchema.parse(memberId);
    uuidSchema.parse(id);
    await service.delete(request.user.userId, memberId, id);
    return reply.status(204).send();
  });
};

export default dietaryRestrictionRoutes;
