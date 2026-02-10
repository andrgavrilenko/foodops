import type { PrismaClient } from '@foodops/db';
import { AppError, ErrorCodes } from '../lib/errors.js';
import { verifyFamilyOwnership } from './family.service.js';

function toRestrictionResponse(r: {
  id: string;
  condition: string;
  notes: string | null;
  createdAt: Date;
}) {
  return {
    id: r.id,
    condition: r.condition,
    notes: r.notes,
    created_at: r.createdAt.toISOString(),
  };
}

export function createMedicalRestrictionService(prisma: PrismaClient) {
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
      data: { condition: string; notes?: string | null },
    ) {
      await verifyMemberOwnership(userId, memberId);

      const restriction = await prisma.medicalRestriction.create({
        data: {
          memberId,
          condition: data.condition,
          notes: data.notes ?? null,
        },
      });
      return toRestrictionResponse(restriction);
    },

    async delete(userId: string, memberId: string, restrictionId: string) {
      await verifyMemberOwnership(userId, memberId);

      const restriction = await prisma.medicalRestriction.findFirst({
        where: { id: restrictionId, memberId },
      });
      if (!restriction) {
        throw new AppError('Medical restriction not found', 404, ErrorCodes.NOT_FOUND);
      }

      await prisma.medicalRestriction.delete({ where: { id: restrictionId } });
    },
  };
}
