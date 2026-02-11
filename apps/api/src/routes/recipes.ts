import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  createRecipeBodySchema,
  updateRecipeBodySchema,
  listRecipesQuerySchema,
  recipeResponseSchema,
  recipeListResponseSchema,
} from '../schemas/recipe.schemas.js';
import { createRecipeService } from '../services/recipe.service.js';
import { idParamSchema } from '../schemas/common.js';

const recipeRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const recipeService = createRecipeService(fastify.prisma);

  // All recipe routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /recipes
  fastify.post(
    '/',
    {
      schema: {
        body: createRecipeBodySchema,
        response: { 201: recipeResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await recipeService.create(request.user.userId, request.body, request.log);
      return reply.status(201).send(result);
    },
  );

  // GET /recipes (list with pagination)
  fastify.get(
    '/',
    {
      schema: {
        querystring: listRecipesQuerySchema,
        response: { 200: recipeListResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await recipeService.list(request.user.userId, request.query);
      return reply.send(result);
    },
  );

  // GET /recipes/:id
  fastify.get(
    '/:id',
    {
      schema: {
        params: idParamSchema,
        response: { 200: recipeResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await recipeService.get(request.params.id);
      return reply.send(result);
    },
  );

  // PATCH /recipes/:id
  fastify.patch(
    '/:id',
    {
      schema: {
        params: idParamSchema,
        body: updateRecipeBodySchema,
        response: { 200: recipeResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await recipeService.update(
        request.user.userId,
        request.params.id,
        request.body,
        request.log,
      );
      return reply.send(result);
    },
  );

  // DELETE /recipes/:id
  fastify.delete(
    '/:id',
    { schema: { params: idParamSchema } },
    async (request, reply) => {
      await recipeService.delete(request.user.userId, request.params.id, request.log);
      return reply.status(204).send();
    },
  );
};

export default recipeRoutes;
