import type { FastifyPluginAsync } from 'fastify';
import {
  createRecipeBodySchema,
  updateRecipeBodySchema,
  listRecipesQuerySchema,
} from '../schemas/recipe.schemas.js';
import { createRecipeService } from '../services/recipe.service.js';
import { uuidSchema } from '../schemas/common.js';
import { zodToFastify } from '../lib/schema-utils.js';

const recipeRoutes: FastifyPluginAsync = async (fastify) => {
  const recipeService = createRecipeService(fastify.prisma);

  // All recipe routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /recipes
  fastify.post(
    '/',
    { schema: { body: zodToFastify(createRecipeBodySchema) } },
    async (request, reply) => {
      const body = createRecipeBodySchema.parse(request.body);
      const result = await recipeService.create(request.user.userId, body);
      return reply.status(201).send(result);
    },
  );

  // GET /recipes (list with pagination)
  fastify.get('/', async (request, reply) => {
    const query = listRecipesQuerySchema.parse(request.query);
    const result = await recipeService.list(query);
    return reply.send(result);
  });

  // GET /recipes/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    uuidSchema.parse(id);
    const result = await recipeService.get(id);
    return reply.send(result);
  });

  // PATCH /recipes/:id
  fastify.patch(
    '/:id',
    { schema: { body: zodToFastify(updateRecipeBodySchema) } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      uuidSchema.parse(id);
      const body = updateRecipeBodySchema.parse(request.body);
      const result = await recipeService.update(request.user.userId, id, body);
      return reply.send(result);
    },
  );

  // DELETE /recipes/:id
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    uuidSchema.parse(id);
    await recipeService.delete(request.user.userId, id);
    return reply.status(204).send();
  });
};

export default recipeRoutes;
