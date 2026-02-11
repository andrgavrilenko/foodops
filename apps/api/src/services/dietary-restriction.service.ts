import type { PrismaClient } from '@foodops/db';
import { AppError, ErrorCodes, isPrismaUniqueError } from '../lib/errors.js';
import { verifyMemberOwnership } from '../lib/ownership.js';
import { toDietaryRestrictionResponse } from '../lib/response-mappers.js';
import type { FastifyBaseLogger } from '../lib/logger.js';

export function createDietaryRestrictionService(prisma: PrismaClient) {
  return {
    async create(
      userId: string,
      memberId: string,
      data: {
        type: 'ALLERGY' | 'INTOLERANCE' | 'LIFESTYLE';
        value: string;
        severity: 'STRICT' | 'MODERATE' | 'MILD';
      },
      log?: FastifyBaseLogger,
    ) {
      await verifyMemberOwnership(prisma, userId, memberId);

      try {
        const restriction = await prisma.dietaryRestriction.create({
          data: {
            memberId,
            type: data.type,
            value: data.value,
            severity: data.severity,
          },
        });
        log?.info({ event: 'dietary_restriction_added', userId, memberId, restrictionId: restriction.id }, 'Dietary restriction added');
        return toDietaryRestrictionResponse(restriction);
      } catch (err) {
        if (isPrismaUniqueError(err)) {
          throw new AppError(
            'Duplicate dietary restriction',
            409,
            ErrorCodes.RESTRICTION_DUPLICATE,
          );
        }
        throw err;
      }
    },

    async delete(userId: string, memberId: string, restrictionId: string, log?: FastifyBaseLogger) {
      await verifyMemberOwnership(prisma, userId, memberId);

      const restriction = await prisma.dietaryRestriction.findFirst({
        where: { id: restrictionId, memberId },
      });
      if (!restriction) {
        throw new AppError('Dietary restriction not found', 404, ErrorCodes.NOT_FOUND);
      }

      await prisma.dietaryRestriction.delete({ where: { id: restrictionId } });
      log?.info({ event: 'dietary_restriction_removed', userId, memberId, restrictionId }, 'Dietary restriction removed');
    },
  };
}
