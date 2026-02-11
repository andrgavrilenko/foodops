import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  generateMenuBodySchema,
  replaceMealBodySchema,
  lockMealBodySchema,
  menuHistoryQuerySchema,
  menuResponseSchema,
  menuHistoryResponseSchema,
  mealResponseSchema,
  alternativesResponseSchema,
} from '../schemas/menu.schemas.js';
import { createMenuService } from '../services/menu.service.js';
import { idParamSchema, menuMealParamSchema } from '../schemas/common.js';

const menuRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const menuService = createMenuService(fastify.prisma, fastify.config, fastify.ai);

  // All menu routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  // POST /menu/generate
  fastify.post(
    '/generate',
    {
      schema: {
        body: generateMenuBodySchema,
        response: { 200: menuResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await menuService.generate(request.user.userId, request.body, request.log);
      return reply.send(result);
    },
  );

  // GET /menu/current
  fastify.get(
    '/current',
    { schema: { response: { 200: menuResponseSchema } } },
    async (request, reply) => {
      const result = await menuService.getCurrent(request.user.userId);
      return reply.send(result);
    },
  );

  // GET /menu/history
  fastify.get(
    '/history',
    {
      schema: {
        querystring: menuHistoryQuerySchema,
        response: { 200: menuHistoryResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await menuService.getHistory(request.user.userId, request.query);
      return reply.send(result);
    },
  );

  // GET /menu/:id
  fastify.get(
    '/:id',
    {
      schema: {
        params: idParamSchema,
        response: { 200: menuResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await menuService.getById(request.user.userId, request.params.id);
      return reply.send(result);
    },
  );

  // POST /menu/:menuId/meals/:mealId/alternatives
  fastify.post(
    '/:menuId/meals/:mealId/alternatives',
    {
      schema: {
        params: menuMealParamSchema,
        response: { 200: alternativesResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await menuService.getAlternatives(
        request.user.userId,
        request.params.menuId,
        request.params.mealId,
        request.log,
      );
      return reply.send(result);
    },
  );

  // PATCH /menu/:menuId/meals/:mealId
  fastify.patch(
    '/:menuId/meals/:mealId',
    {
      schema: {
        params: menuMealParamSchema,
        body: replaceMealBodySchema,
        response: { 200: mealResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await menuService.replaceMeal(
        request.user.userId,
        request.params.menuId,
        request.params.mealId,
        request.body.recipe_id,
        request.log,
      );
      return reply.send(result);
    },
  );

  // PATCH /menu/:menuId/meals/:mealId/lock
  fastify.patch(
    '/:menuId/meals/:mealId/lock',
    {
      schema: {
        params: menuMealParamSchema,
        body: lockMealBodySchema,
        response: { 200: mealResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await menuService.lockMeal(
        request.user.userId,
        request.params.menuId,
        request.params.mealId,
        request.body.is_locked,
        request.log,
      );
      return reply.send(result);
    },
  );

  // POST /menu/:id/approve
  fastify.post(
    '/:id/approve',
    {
      schema: {
        params: idParamSchema,
        response: { 200: menuResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await menuService.approve(request.user.userId, request.params.id, request.log);
      return reply.send(result);
    },
  );
};

export default menuRoutes;
