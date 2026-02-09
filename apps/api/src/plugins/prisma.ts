import fp from 'fastify-plugin';
import { prisma } from '@foodops/db';
import type { PrismaClient } from '@foodops/db';
import type { FastifyPluginAsync } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
    fastify.log.info('Prisma client disconnected');
  });

  fastify.log.info('Prisma plugin registered');
};

export default fp(prismaPlugin, {
  name: 'prisma',
});
