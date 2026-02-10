import type { PrismaClient } from '@foodops/db';
import { AppError, ErrorCodes } from './errors.js';

export async function verifyFamilyOwnership(prisma: PrismaClient, userId: string) {
  const family = await prisma.family.findUnique({
    where: { userId },
  });
  if (!family) {
    throw new AppError('Family not found', 404, ErrorCodes.FAMILY_NOT_FOUND);
  }
  return family;
}

export async function verifyMemberOwnership(
  prisma: PrismaClient,
  userId: string,
  memberId: string,
) {
  const family = await verifyFamilyOwnership(prisma, userId);
  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, familyId: family.id },
  });
  if (!member) {
    throw new AppError('Family member not found', 404, ErrorCodes.RESTRICTION_MEMBER_NOT_FOUND);
  }
  return member;
}
