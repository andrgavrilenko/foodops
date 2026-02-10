import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Mock @foodops/db before importing app — prevents real DB connection
vi.mock('@foodops/db', () => {
  const mockPrisma = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  };
  return {
    prisma: mockPrisma,
    db: mockPrisma,
    PrismaClient: vi.fn(() => mockPrisma),
  };
});

// Set required env vars before loading config
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/testdb';
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'fatal';

const { buildApp } = await import('../app.js');
const { loadConfig } = await import('../config.js');

describe('Health endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const config = loadConfig();
    app = buildApp(config);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('uptime');
    });

    it('should return valid ISO timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = response.json();
      const parsed = new Date(body.timestamp);
      expect(parsed.toISOString()).toBe(body.timestamp);
    });

    it('should return version 0.0.1', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = response.json();
      expect(body.version).toBe('0.0.1');
    });
  });

  describe('GET /health/db', () => {
    it('should return 200 with status ok when DB is available', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/db',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('responseTimeMs');
      expect(typeof body.responseTimeMs).toBe('number');
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 with all checks ok', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('checks');
      expect(body.checks.app.status).toBe('ok');
      expect(body.checks.database.status).toBe('ok');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/nonexistent',
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});
