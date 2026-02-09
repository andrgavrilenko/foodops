import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import type { AppConfig } from './config.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import corsPlugin from './plugins/cors.js';
import prismaPlugin from './plugins/prisma.js';
import healthRoutes from './routes/health.js';

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
  app.register(prismaPlugin);

  // Register routes
  app.register(healthRoutes, { prefix: '/health' });

  return app;
}
