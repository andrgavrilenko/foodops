import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { createAiMenuGenerator, type AiMenuGenerator } from '../services/ai-menu-generator.js';

declare module 'fastify' {
  interface FastifyInstance {
    ai: AiMenuGenerator;
  }
}

const aiPlugin: FastifyPluginAsync = async (fastify) => {
  const generator = createAiMenuGenerator(fastify.config);
  fastify.decorate('ai', generator);
  fastify.log.info('AI plugin registered');
};

export default fp(aiPlugin, { name: 'ai', dependencies: ['auth'] });
