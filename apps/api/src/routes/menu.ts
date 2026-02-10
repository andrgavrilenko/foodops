import type { FastifyPluginAsync } from 'fastify';
import {
  generateMenuBodySchema,
  replaceMealBodySchema,
  lockMealBodySchema,
  menuHistoryQuerySchema,
} from '../schemas/menu.schemas.js';
import { createMenuService } from '../services/menu.service.js';
import { uuidSchema } from '../schemas/common.js';
import { zodToFastify } from '../lib/schema-utils.js';

const menuRoutes: FastifyPluginAsync = async (fastify) => {
  const menuService = createMenuService(fastify.prisma, fastify.config, fastify.ai);

  // All menu routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /menu/generate
  fastify.post(
    '/generate',
    { schema: { body: zodToFastify(generateMenuBodySchema) } },
    async (request, reply) => {
      const body = generateMenuBodySchema.parse(request.body);
      const result = await menuService.generate(request.user.userId, body);
      return reply.send(result);
    },
  );

  // GET /menu/current
  fastify.get('/current', async (request, reply) => {
    const result = await menuService.getCurrent(request.user.userId);
    return reply.send(result);
  });

  // GET /menu/history
  fastify.get('/history', async (request, reply) => {
    const query = menuHistoryQuerySchema.parse(request.query);
    const result = await menuService.getHistory(request.user.userId, query);
    return reply.send(result);
  });

  // GET /menu/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    uuidSchema.parse(id);
    const result = await menuService.getById(request.user.userId, id);
    return reply.send(result);
  });

  // POST /menu/:menuId/meals/:mealId/alternatives
  fastify.post('/:menuId/meals/:mealId/alternatives', async (request, reply) => {
    const { menuId, mealId } = request.params as { menuId: string; mealId: string };
    uuidSchema.parse(menuId);
    uuidSchema.parse(mealId);
    const result = await menuService.getAlternatives(request.user.userId, menuId, mealId);
    return reply.send(result);
  });

  // PATCH /menu/:menuId/meals/:mealId
  fastify.patch(
    '/:menuId/meals/:mealId',
    { schema: { body: zodToFastify(replaceMealBodySchema) } },
    async (request, reply) => {
      const { menuId, mealId } = request.params as { menuId: string; mealId: string };
      uuidSchema.parse(menuId);
      uuidSchema.parse(mealId);
      const body = replaceMealBodySchema.parse(request.body);
      const result = await menuService.replaceMeal(
        request.user.userId,
        menuId,
        mealId,
        body.recipe_id,
      );
      return reply.send(result);
    },
  );

  // PATCH /menu/:menuId/meals/:mealId/lock
  fastify.patch(
    '/:menuId/meals/:mealId/lock',
    { schema: { body: zodToFastify(lockMealBodySchema) } },
    async (request, reply) => {
      const { menuId, mealId } = request.params as { menuId: string; mealId: string };
      uuidSchema.parse(menuId);
      uuidSchema.parse(mealId);
      const body = lockMealBodySchema.parse(request.body);
      const result = await menuService.lockMeal(
        request.user.userId,
        menuId,
        mealId,
        body.is_locked,
      );
      return reply.send(result);
    },
  );

  // POST /menu/:id/approve
  fastify.post('/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    uuidSchema.parse(id);
    const result = await menuService.approve(request.user.userId, id);
    return reply.send(result);
  });
};

export default menuRoutes;
