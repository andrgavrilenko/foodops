import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PRISMA_SCHEMA_PATH = resolve(__dirname, '../../../../../packages/db/prisma/schema.prisma');

let container: StartedPostgreSqlContainer | null = null;
let prismaClient: PrismaClient | null = null;

/**
 * Check if Docker is available. Returns false if Docker is not running.
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Start a PostgreSQL testcontainer and run Prisma migrations.
 * Returns a PrismaClient connected to the test database.
 */
export async function setupTestDatabase(): Promise<PrismaClient> {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_foodops')
    .withUsername('test')
    .withPassword('test')
    .start();

  const connectionUri = container.getConnectionUri();

  // Run prisma db push to apply schema (faster than migrate for testing)
  execSync(`npx prisma db push --schema="${PRISMA_SCHEMA_PATH}" --skip-generate`, {
    env: { ...process.env, DATABASE_URL: connectionUri },
    stdio: 'pipe',
    timeout: 30_000,
  });

  prismaClient = new PrismaClient({
    datasources: { db: { url: connectionUri } },
  });

  await prismaClient.$connect();
  return prismaClient;
}

/**
 * Get the connection URI for the running test container.
 */
export function getConnectionUri(): string {
  if (!container) throw new Error('Test database not started');
  return container.getConnectionUri();
}

/**
 * Clean all tables (truncate) between tests while keeping the schema.
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  // Truncate all tables in dependency order (cascade handles the rest)
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      shopping_list_items,
      shopping_lists,
      meals,
      menu_days,
      weekly_menus,
      recipe_ingredients,
      recipes,
      ingredient_mappings,
      ingredients,
      products,
      preferences,
      medical_restrictions,
      dietary_restrictions,
      family_members,
      families,
      refresh_tokens,
      users,
      stores
    CASCADE
  `);
}

/**
 * Tear down the test database container.
 */
export async function teardownTestDatabase(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
  if (container) {
    await container.stop();
    container = null;
  }
}
