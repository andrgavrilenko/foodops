// @deprecated — No longer needed. fastify-type-provider-zod handles Zod→JSON Schema conversion natively.
// This file can be safely deleted. Kept temporarily for reference.

import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodType } from 'zod';

/** @deprecated Use fastify-type-provider-zod instead of manual conversion. */
export function zodToFastify(schema: ZodType) {
  const result = zodToJsonSchema(schema, {
    target: 'jsonSchema7',
  }) as Record<string, unknown>;
  delete result['$schema'];
  return result;
}
