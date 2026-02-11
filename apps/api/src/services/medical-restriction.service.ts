import type { PrismaClient } from '@foodops/db';
import { AppError, ErrorCodes } from '../lib/errors.js';
import { verifyMemberOwnership } from '../lib/ownership.js';
import { toMedicalRestrictionResponse } from '../lib/response-mappers.js';
import type { FastifyBaseLogger } from '../lib/logger.js';

export function createMedicalRestrictionService(prisma: PrismaClient) {
  return {
    async create(
      userId: string,
      memberId: string,
      data: { condition: string; notes?: string | null },
      log?: FastifyBaseLogger,
    ) {
      await verifyMemberOwnership(prisma, userId, memberId);

      const restriction = await prisma.medicalRestriction.create({
        data: {
          memberId,
          condition: data.condition,
          notes: data.notes ?? null,
        },
      });
      log?.info({ event: 'medical_restriction_added', userId, memberId, restrictionId: restriction.id }, 'Medical restriction added');
      return toMedicalRestrictionResponse(restriction);
    },

    async delete(userId: string, memberId: string, restrictionId: string, log?: FastifyBaseLogger) {
      await verifyMemberOwnership(prisma, userId, memberId);

      const restriction = await prisma.medicalRestriction.findFirst({
        where: { id: restrictionId, memberId },
      });
      if (!restriction) {
        throw new AppError('Medical restriction not found', 404, ErrorCodes.NOT_FOUND);
      }

      await prisma.medicalRestriction.delete({ where: { id: restrictionId } });
      log?.info({ event: 'medical_restriction_removed', userId, memberId, restrictionId }, 'Medical restriction removed');
    },
  };
}
