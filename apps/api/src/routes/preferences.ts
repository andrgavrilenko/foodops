import type { FastifyPluginAsync } from 'fastify';
import { createPreferenceBodySchema } from '../schemas/preference.schemas.js';
import { createPreferenceService } from '../services/preference.service.js';
import { uuidSchema } from '../schemas/common.js';
import { zodToFastify } from '../lib/schema-utils.js';

const preferenceRoutes: FastifyPluginAsync = async (fastify) => {
  const service = createPreferenceService(fastify.prisma);

  fastify.addHook('preHandler', fastify.authenticate);

  // POST /family/preferences
  fastify.post(
    '/',
    { schema: { body: zodToFastify(createPreferenceBodySchema) } },
    async (request, reply) => {
      const body = createPreferenceBodySchema.parse(request.body);
      const result = await service.create(request.user.userId, body);
      return reply.status(201).send(result);
    },
  );

  // GET /family/preferences
  fastify.get('/', async (request, reply) => {
    const result = await service.list(request.user.userId);
    return reply.send(result);
  });

  // DELETE /family/preferences/:id
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    uuidSchema.parse(id);
    await service.delete(request.user.userId, id);
    return reply.status(204).send();
  });
};

export default preferenceRoutes;
