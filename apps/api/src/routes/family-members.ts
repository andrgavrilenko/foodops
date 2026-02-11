import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  createMemberBodySchema,
  updateMemberBodySchema,
  memberResponseSchema,
} from '../schemas/family-member.schemas.js';
import { createFamilyMemberService } from '../services/family-member.service.js';
import { idParamSchema } from '../schemas/common.js';

const familyMemberRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const memberService = createFamilyMemberService(fastify.prisma);

  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /family/members
  fastify.post(
    '/',
    {
      schema: {
        body: createMemberBodySchema,
        response: { 201: memberResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await memberService.create(request.user.userId, request.body, request.log);
      return reply.status(201).send(result);
    },
  );

  // PATCH /family/members/:id
  fastify.patch(
    '/:id',
    {
      schema: {
        params: idParamSchema,
        body: updateMemberBodySchema,
        response: { 200: memberResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await memberService.update(
        request.user.userId,
        request.params.id,
        request.body,
        request.log,
      );
      return reply.send(result);
    },
  );

  // DELETE /family/members/:id
  fastify.delete(
    '/:id',
    { schema: { params: idParamSchema } },
    async (request, reply) => {
      await memberService.delete(request.user.userId, request.params.id, request.log);
      return reply.status(204).send();
    },
  );
};

export default familyMemberRoutes;
