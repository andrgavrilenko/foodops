import type { FastifyPluginAsync } from 'fastify';
import {
  createMemberBodySchema,
  updateMemberBodySchema,
} from '../schemas/family-member.schemas.js';
import { createFamilyMemberService } from '../services/family-member.service.js';
import { uuidSchema } from '../schemas/common.js';
import { zodToFastify } from '../lib/schema-utils.js';

const familyMemberRoutes: FastifyPluginAsync = async (fastify) => {
  const memberService = createFamilyMemberService(fastify.prisma);

  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /family/members
  fastify.post(
    '/',
    { schema: { body: zodToFastify(createMemberBodySchema) } },
    async (request, reply) => {
      const body = createMemberBodySchema.parse(request.body);
      const result = await memberService.create(request.user.userId, body);
      return reply.status(201).send(result);
    },
  );

  // PATCH /family/members/:id
  fastify.patch(
    '/:id',
    { schema: { body: zodToFastify(updateMemberBodySchema) } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      uuidSchema.parse(id);
      const body = updateMemberBodySchema.parse(request.body);
      const result = await memberService.update(request.user.userId, id, body);
      return reply.send(result);
    },
  );

  // DELETE /family/members/:id
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    uuidSchema.parse(id);
    await memberService.delete(request.user.userId, id);
    return reply.status(204).send();
  });
};

export default familyMemberRoutes;
