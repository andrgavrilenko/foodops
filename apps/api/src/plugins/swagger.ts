import { createRequire } from 'node:module';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyPluginAsync } from 'fastify';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'FoodOps API',
        description: 'AI-powered family meal planning and grocery ordering',
        version: pkg.version,
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
  });

  fastify.log.info('Swagger plugin registered');
};

export default fp(swaggerPlugin, {
  name: 'swagger',
});
