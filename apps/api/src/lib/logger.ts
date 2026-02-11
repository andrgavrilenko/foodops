import type { FastifyBaseLogger } from 'fastify';

/** Re-export for convenience in service signatures */
export type { FastifyBaseLogger };

/** No-op logger used when no request logger is available (e.g., tests) */
export const noopLogger: FastifyBaseLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  debug: () => {},
  trace: () => {},
  child: () => noopLogger,
  level: 'silent',
  silent: () => {},
} as unknown as FastifyBaseLogger;
