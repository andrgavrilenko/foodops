import { vi } from 'vitest';

// Set env vars before any imports
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/testdb';
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'fatal';
process.env['JWT_SECRET'] = 'test-secret-must-be-at-least-32-characters-long';
process.env['OPENAI_API_KEY'] = 'test-openai-key';
process.env['OPENAI_MODEL'] = 'gpt-4o-mini';

// Create mock Prisma with all model methods needed for Phase 1
export function createMockPrisma() {
  return {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    family: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    familyMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    dietaryRestriction: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    medicalRestriction: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    preference: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    recipe: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    recipeIngredient: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    ingredient: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    weeklyMenu: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    menuDay: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    meal: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

// Shared mock instance — reset between tests via vi.clearAllMocks()
export const mockPrisma = createMockPrisma();

// Mock the @foodops/db module
vi.mock('@foodops/db', () => ({
  prisma: mockPrisma,
  db: mockPrisma,
  PrismaClient: vi.fn(() => mockPrisma),
}));
