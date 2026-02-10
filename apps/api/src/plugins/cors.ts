import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const origins = fastify.config.CORS_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  await fastify.register(cors, {
    origin: origins.length === 1 ? origins[0] : origins,
  });

  fastify.log.info('CORS plugin registered');
};

export default fp(corsPlugin, {
  name: 'cors',
  dependencies: [],
});
