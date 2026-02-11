import type { PrismaClient } from '@foodops/db';
import { AppError, ErrorCodes } from '../lib/errors.js';
import { verifyFamilyOwnership } from '../lib/ownership.js';
import { toMemberResponse } from '../lib/response-mappers.js';
import type { FastifyBaseLogger } from '../lib/logger.js';

const MAX_MEMBERS = 10;

export function createFamilyMemberService(prisma: PrismaClient) {
  return {
    async create(
      userId: string,
      data: { name: string; age: number; role: 'ADULT' | 'CHILD' | 'INFANT' },
      log?: FastifyBaseLogger,
    ) {
      const family = await verifyFamilyOwnership(prisma, userId);

      const memberCount = await prisma.familyMember.count({
        where: { familyId: family.id },
      });
      if (memberCount >= MAX_MEMBERS) {
        throw new AppError(
          `Family cannot have more than ${MAX_MEMBERS} members`,
          400,
          ErrorCodes.FAMILY_MEMBER_LIMIT_EXCEEDED,
        );
      }

      const member = await prisma.familyMember.create({
        data: {
          familyId: family.id,
          name: data.name,
          age: data.age,
          role: data.role,
        },
      });
      log?.info({ event: 'member_added', userId, memberId: member.id, familyId: family.id }, 'Family member added');
      return toMemberResponse(member);
    },

    async update(
      userId: string,
      memberId: string,
      data: { name?: string; age?: number; role?: 'ADULT' | 'CHILD' | 'INFANT' },
      log?: FastifyBaseLogger,
    ) {
      const family = await verifyFamilyOwnership(prisma, userId);

      const member = await prisma.familyMember.findFirst({
        where: { id: memberId, familyId: family.id },
      });
      if (!member) {
        throw new AppError('Family member not found', 404, ErrorCodes.FAMILY_MEMBER_NOT_FOUND);
      }

      const updated = await prisma.familyMember.update({
        where: { id: memberId },
        data,
      });
      log?.info({ event: 'member_updated', userId, memberId }, 'Family member updated');
      return toMemberResponse(updated);
    },

    async delete(userId: string, memberId: string, log?: FastifyBaseLogger) {
      const family = await verifyFamilyOwnership(prisma, userId);

      const member = await prisma.familyMember.findFirst({
        where: { id: memberId, familyId: family.id },
      });
      if (!member) {
        throw new AppError('Family member not found', 404, ErrorCodes.FAMILY_MEMBER_NOT_FOUND);
      }

      await prisma.familyMember.delete({ where: { id: memberId } });
      log?.info({ event: 'member_removed', userId, memberId }, 'Family member removed');
    },
  };
}
