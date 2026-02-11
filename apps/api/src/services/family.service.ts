import type { PrismaClient, Prisma } from '@foodops/db';
import { AppError, ErrorCodes, isPrismaUniqueError } from '../lib/errors.js';
import { verifyFamilyOwnership } from '../lib/ownership.js';
import { toFamilyResponse } from '../lib/response-mappers.js';
import type { FastifyBaseLogger } from '../lib/logger.js';

export function createFamilyService(prisma: PrismaClient) {
  return {
    async create(
      userId: string,
      data: {
        name: string;
        weekly_budget?: number;
        meals_per_day: number;
        calorie_target_per_person?: number;
        preferred_store_id?: string;
      },
      log?: FastifyBaseLogger,
    ) {
      try {
        const family = await prisma.family.create({
          data: {
            userId,
            name: data.name,
            weeklyBudget: data.weekly_budget ?? null,
            mealsPerDay: data.meals_per_day,
            calorieTargetPerPerson: data.calorie_target_per_person ?? null,
            preferredStoreId: data.preferred_store_id ?? null,
          },
        });
        log?.info({ event: 'family_created', userId, familyId: family.id }, 'Family created');
        return toFamilyResponse(family);
      } catch (err) {
        if (isPrismaUniqueError(err)) {
          throw new AppError('User already has a family', 409, ErrorCodes.FAMILY_ALREADY_EXISTS);
        }
        throw err;
      }
    },

    async get(userId: string) {
      const family = await prisma.family.findUnique({
        where: { userId },
        include: {
          members: {
            include: {
              dietaryRestrictions: true,
              medicalRestrictions: true,
            },
          },
          preferences: true,
        },
      });
      if (!family) {
        throw new AppError('Family not found', 404, ErrorCodes.FAMILY_NOT_FOUND);
      }
      return toFamilyResponse(family);
    },

    async update(
      userId: string,
      data: {
        name?: string;
        weekly_budget?: number | null;
        meals_per_day?: number;
        calorie_target_per_person?: number | null;
        preferred_store_id?: string | null;
      },
      log?: FastifyBaseLogger,
    ) {
      await verifyFamilyOwnership(prisma, userId);

      const updateData: Prisma.FamilyUncheckedUpdateInput = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.weekly_budget !== undefined) updateData.weeklyBudget = data.weekly_budget;
      if (data.meals_per_day !== undefined) updateData.mealsPerDay = data.meals_per_day;
      if (data.calorie_target_per_person !== undefined)
        updateData.calorieTargetPerPerson = data.calorie_target_per_person;
      if (data.preferred_store_id !== undefined)
        updateData.preferredStoreId = data.preferred_store_id;

      const family = await prisma.family.update({
        where: { userId },
        data: updateData,
      });
      log?.info({ event: 'family_updated', userId, familyId: family.id }, 'Family updated');
      return toFamilyResponse(family);
    },
  };
}
