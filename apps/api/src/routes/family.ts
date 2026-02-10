import type { FastifyPluginAsync } from 'fastify';
import { createFamilyBodySchema, updateFamilyBodySchema } from '../schemas/family.schemas.js';
import { createFamilyService } from '../services/family.service.js';

const familyRoutes: FastifyPluginAsync = async (fastify) => {
  const familyService = createFamilyService(fastify.prisma);

  // All family routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /family
  fastify.post('/', async (request, reply) => {
    const body = createFamilyBodySchema.parse(request.body);
    const result = await familyService.create(request.user.userId, body);
    return reply.status(201).send(result);
  });

  // GET /family
  fastify.get('/', async (request, reply) => {
    const result = await familyService.get(request.user.userId);
    return reply.send(result);
  });

  // PATCH /family
  fastify.patch('/', async (request, reply) => {
    const body = updateFamilyBodySchema.parse(request.body);
    const result = await familyService.update(request.user.userId, body);
    return reply.send(result);
  });
};

export default familyRoutes;
