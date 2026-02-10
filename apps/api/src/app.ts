import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import type { AppConfig } from './config.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import corsPlugin from './plugins/cors.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';
import swaggerPlugin from './plugins/swagger.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import familyRoutes from './routes/family.js';
import familyMemberRoutes from './routes/family-members.js';
import dietaryRestrictionRoutes from './routes/dietary-restrictions.js';
import medicalRestrictionRoutes from './routes/medical-restrictions.js';
import preferenceRoutes from './routes/preferences.js';
import recipeRoutes from './routes/recipes.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export function buildApp(config: AppConfig) {
  const isProduction = config.NODE_ENV === 'production';

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
                colorize: true,
              },
            },
          }),
    },
  });

  // Decorate with config
  app.decorate('config', config);

  // Register plugins in order
  app.register(sensible);
  app.register(errorHandlerPlugin);
  app.register(corsPlugin);
  app.register(rateLimitPlugin);
  app.register(prismaPlugin);
  app.register(authPlugin);
  app.register(swaggerPlugin);

  // Register routes
  app.register(healthRoutes, { prefix: '/health' });
  app.register(authRoutes, { prefix: '/auth' });
  app.register(familyRoutes, { prefix: '/family' });
  app.register(familyMemberRoutes, { prefix: '/family/members' });
  app.register(dietaryRestrictionRoutes, { prefix: '/family/members' });
  app.register(medicalRestrictionRoutes, { prefix: '/family/members' });
  app.register(preferenceRoutes, { prefix: '/family/preferences' });
  app.register(recipeRoutes, { prefix: '/recipes' });

  return app;
}
