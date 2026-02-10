import type { PrismaClient } from '@foodops/db';
import { AppError, ErrorCodes } from '../lib/errors.js';
import { verifyFamilyOwnership } from './family.service.js';

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
  async function verifyMemberOwnership(userId: string, memberId: string) {
    const family = await verifyFamilyOwnership(prisma, userId);
    const member = await prisma.familyMember.findFirst({
      where: { id: memberId, familyId: family.id },
    });
    if (!member) {
      throw new AppError('Family member not found', 404, ErrorCodes.RESTRICTION_MEMBER_NOT_FOUND);
    }
    return member;
  }

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
      await verifyMemberOwnership(userId, memberId);

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
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === 'P2002'
        ) {
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
      await verifyMemberOwnership(userId, memberId);

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
