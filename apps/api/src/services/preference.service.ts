import type { PrismaClient } from '@foodops/db';
import { AppError, ErrorCodes } from '../lib/errors.js';
import { verifyFamilyOwnership } from '../lib/ownership.js';
import { toPreferenceResponse } from '../lib/response-mappers.js';
import type { FastifyBaseLogger } from '../lib/logger.js';

export function createPreferenceService(prisma: PrismaClient) {
  return {
    async create(
      userId: string,
      data: { type: 'CUISINE' | 'EXCLUDED_INGREDIENT' | 'FAVORITE_RECIPE'; value: string },
      log?: FastifyBaseLogger,
    ) {
      const family = await verifyFamilyOwnership(prisma, userId);

      const preference = await prisma.preference.create({
        data: {
          familyId: family.id,
          type: data.type,
          value: data.value,
        },
      });
      log?.info({ event: 'preference_added', userId, familyId: family.id, preferenceId: preference.id }, 'Preference added');
      return toPreferenceResponse(preference);
    },

    async list(userId: string) {
      const family = await verifyFamilyOwnership(prisma, userId);

      const preferences = await prisma.preference.findMany({
        where: { familyId: family.id },
        orderBy: { createdAt: 'desc' },
      });
      return preferences.map(toPreferenceResponse);
    },

    async delete(userId: string, preferenceId: string, log?: FastifyBaseLogger) {
      const family = await verifyFamilyOwnership(prisma, userId);

      const preference = await prisma.preference.findFirst({
        where: { id: preferenceId, familyId: family.id },
      });
      if (!preference) {
        throw new AppError('Preference not found', 404, ErrorCodes.PREFERENCE_NOT_FOUND);
      }

      await prisma.preference.delete({ where: { id: preferenceId } });
      log?.info({ event: 'preference_removed', userId, preferenceId }, 'Preference removed');
    },
  };
}
