import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodType } from 'zod';

export function zodToFastify(schema: ZodType) {
  const result = zodToJsonSchema(schema, {
    target: 'jsonSchema7',
  }) as Record<string, unknown>;
  delete result['$schema'];
  return result;
}
