import type { PrismaClient, Prisma } from '@foodops/db';
import { AppError, ErrorCodes, isPrismaUniqueError } from '../lib/errors.js';
import { verifyFamilyOwnership } from '../lib/ownership.js';

function toFamilyResponse(family: {
  id: string;
  name: string;
  weeklyBudget: Prisma.Decimal | null;
  mealsPerDay: number;
  calorieTargetPerPerson: number | null;
  preferredStoreId: string | null;
  createdAt: Date;
  updatedAt: Date;
  members?: Array<{
    id: string;
    name: string;
    age: number;
    role: string;
    createdAt: Date;
    updatedAt: Date;
    dietaryRestrictions?: Array<{
      id: string;
      type: string;
      value: string;
      severity: string;
      createdAt: Date;
    }>;
    medicalRestrictions?: Array<{
      id: string;
      condition: string;
      notes: string | null;
      createdAt: Date;
    }>;
  }>;
  preferences?: Array<{
    id: string;
    type: string;
    value: string;
    createdAt: Date;
  }>;
}) {
  return {
    id: family.id,
    name: family.name,
    weekly_budget: family.weeklyBudget ? Number(family.weeklyBudget) : null,
    meals_per_day: family.mealsPerDay,
    calorie_target_per_person: family.calorieTargetPerPerson,
    preferred_store_id: family.preferredStoreId,
    created_at: family.createdAt.toISOString(),
    updated_at: family.updatedAt.toISOString(),
    members: family.members?.map((m) => ({
      id: m.id,
      name: m.name,
      age: m.age,
      role: m.role,
      created_at: m.createdAt.toISOString(),
      updated_at: m.updatedAt.toISOString(),
      dietary_restrictions: m.dietaryRestrictions?.map((d) => ({
        id: d.id,
        type: d.type,
        value: d.value,
        severity: d.severity,
        created_at: d.createdAt.toISOString(),
      })),
      medical_restrictions: m.medicalRestrictions?.map((mr) => ({
        id: mr.id,
        condition: mr.condition,
        notes: mr.notes,
        created_at: mr.createdAt.toISOString(),
      })),
    })),
    preferences: family.preferences?.map((p) => ({
      id: p.id,
      type: p.type,
      value: p.value,
      created_at: p.createdAt.toISOString(),
    })),
  };
}

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
      return toFamilyResponse(family);
    },
  };
}
