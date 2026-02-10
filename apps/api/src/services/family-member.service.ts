import type { PrismaClient } from '@foodops/db';
import { AppError, ErrorCodes } from '../lib/errors.js';
import { verifyFamilyOwnership } from './family.service.js';

const MAX_MEMBERS = 10;

function toMemberResponse(member: {
  id: string;
  name: string;
  age: number;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: member.id,
    name: member.name,
    age: member.age,
    role: member.role,
    created_at: member.createdAt.toISOString(),
    updated_at: member.updatedAt.toISOString(),
  };
}

export function createFamilyMemberService(prisma: PrismaClient) {
  return {
    async create(
      userId: string,
      data: { name: string; age: number; role: 'ADULT' | 'CHILD' | 'INFANT' },
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
      return toMemberResponse(member);
    },

    async update(
      userId: string,
      memberId: string,
      data: { name?: string; age?: number; role?: 'ADULT' | 'CHILD' | 'INFANT' },
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
      return toMemberResponse(updated);
    },

    async delete(userId: string, memberId: string) {
      const family = await verifyFamilyOwnership(prisma, userId);

      const member = await prisma.familyMember.findFirst({
        where: { id: memberId, familyId: family.id },
      });
      if (!member) {
        throw new AppError('Family member not found', 404, ErrorCodes.FAMILY_MEMBER_NOT_FOUND);
      }

      await prisma.familyMember.delete({ where: { id: memberId } });
    },
  };
}
