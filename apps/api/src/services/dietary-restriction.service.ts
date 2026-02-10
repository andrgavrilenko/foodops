import type { PrismaClient } from '@foodops/db';
import { AppError, ErrorCodes, isPrismaUniqueError } from '../lib/errors.js';
import { verifyMemberOwnership } from '../lib/ownership.js';

function toRestrictionResponse(r: {
  id: string;
  type: string;
  value: string;
  severity: string;
  createdAt: Date;
}) {
  return {
    id: r.id,
    type: r.type,
    value: r.value,
    severity: r.severity,
    created_at: r.createdAt.toISOString(),
  };
}

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
        return toRestrictionResponse(restriction);
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

    async delete(userId: string, memberId: string, restrictionId: string) {
      await verifyMemberOwnership(prisma, userId, memberId);

      const restriction = await prisma.dietaryRestriction.findFirst({
        where: { id: restrictionId, memberId },
      });
      if (!restriction) {
        throw new AppError('Dietary restriction not found', 404, ErrorCodes.NOT_FOUND);
      }

      await prisma.dietaryRestriction.delete({ where: { id: restrictionId } });
    },
  };
}
