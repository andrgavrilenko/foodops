import type { PrismaClient } from '@foodops/db';
import { AppError, ErrorCodes } from '../lib/errors.js';
import { verifyMemberOwnership } from '../lib/ownership.js';

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
  return {
    async create(
      userId: string,
      memberId: string,
      data: { condition: string; notes?: string | null },
    ) {
      await verifyMemberOwnership(prisma, userId, memberId);

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
      await verifyMemberOwnership(prisma, userId, memberId);

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
