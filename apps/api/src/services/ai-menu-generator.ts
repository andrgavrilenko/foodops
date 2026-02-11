import OpenAI from 'openai';
import type { AppConfig } from '../config.js';
import {
  aiMenuResponseSchema,
  aiRecipeSchema,
  type AiMenuResponse,
  type AiRecipe,
} from '../schemas/ai-output.schemas.js';
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildAlternativesSystemPrompt,
  type FamilyContext,
} from '../lib/prompt-builder.js';
import {
  validateRestrictionCompliance,
  validateUniqueness,
  validateCompleteness,
  validateMealCount,
} from '../lib/menu-validator.js';
import { z } from 'zod';
import type { FastifyBaseLogger } from '../lib/logger.js';

const MAX_RETRIES = 3;
const ALTERNATIVES_MAX_RETRIES = 2;

export interface AiMenuGenerator {
  generateWeeklyMenu(context: FamilyContext, log?: FastifyBaseLogger): Promise<AiMenuResponse>;
  generateAlternatives(
    context: FamilyContext,
    existingRecipeTitles: string[],
    mealType: string,
    log?: FastifyBaseLogger,
  ): Promise<AiRecipe[]>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAiMenuGenerator(config: AppConfig): AiMenuGenerator {
  const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY, maxRetries: 2 });
  const model = config.OPENAI_MODEL;

  async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await openai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 8000,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      },
      {
        signal: AbortSignal.timeout(30_000),
      },
    );

    return response.choices[0]?.message?.content ?? '';
  }

  function parseJson(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error('AI response is not valid JSON');
    }
  }

  const alternativesSchema = z.object({
    alternatives: z.array(aiRecipeSchema).min(1).max(5),
  });

  return {
    async generateWeeklyMenu(context: FamilyContext, log?: FastifyBaseLogger): Promise<AiMenuResponse> {
      const systemPrompt = buildSystemPrompt(context.meals_per_day);
      const userPrompt = buildUserPrompt(context);
      const strictRestrictions = context.dietary_restrictions
        .filter((r) => r.severity.toLowerCase() === 'strict')
        .map((r) => ({ value: r.value }));

      let lastError = '';

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const promptWithRetry =
          attempt === 1
            ? userPrompt
            : `${userPrompt}\n\nPREVIOUS ATTEMPT FAILED. Fix these errors:\n${lastError}`;

        log?.info({ event: 'ai_call_started', attempt, type: 'weekly_menu' }, 'AI call started');
        const callStart = performance.now();
        const raw = await callOpenAI(systemPrompt, promptWithRetry);
        const durationMs = Math.round(performance.now() - callStart);
        log?.info({ event: 'ai_call_completed', attempt, durationMs, type: 'weekly_menu' }, 'AI call completed');

        const parsed = parseJson(raw);

        // Step 1: Zod schema validation
        const zodResult = aiMenuResponseSchema.safeParse(parsed);
        if (!zodResult.success) {
          lastError = `Schema validation failed: ${zodResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`;
          log?.warn({ event: 'ai_validation_failed', attempt, step: 'schema', errors: lastError }, 'AI validation failed');
          continue;
        }

        const menu = zodResult.data;

        // Step 2: Meal count validation
        const mealCountResult = validateMealCount(menu, context.meals_per_day);
        if (!mealCountResult.valid) {
          lastError = `Meal count errors: ${mealCountResult.errors.join('; ')}`;
          log?.warn({ event: 'ai_validation_failed', attempt, step: 'meal_count', errors: lastError }, 'AI validation failed');
          continue;
        }

        // Step 3: Restriction compliance
        const restrictionResult = validateRestrictionCompliance(menu, strictRestrictions);
        if (!restrictionResult.valid) {
          lastError = `Restriction violations: ${restrictionResult.errors.join('; ')}. These ingredients are FORBIDDEN.`;
          log?.warn({ event: 'ai_validation_failed', attempt, step: 'restriction_compliance', errors: lastError }, 'AI validation failed');
          continue;
        }

        // Step 4: Uniqueness
        const uniqueResult = validateUniqueness(menu);
        if (!uniqueResult.valid) {
          lastError = `Duplicate recipes: ${uniqueResult.errors.join('; ')}. Each recipe must be unique.`;
          log?.warn({ event: 'ai_validation_failed', attempt, step: 'uniqueness', errors: lastError }, 'AI validation failed');
          continue;
        }

        // Step 5: Completeness
        const completeResult = validateCompleteness(menu);
        if (!completeResult.valid) {
          lastError = `Incomplete recipes: ${completeResult.errors.join('; ')}`;
          log?.warn({ event: 'ai_validation_failed', attempt, step: 'completeness', errors: lastError }, 'AI validation failed');
          continue;
        }

        return menu;
      }

      log?.error({ event: 'ai_generation_exhausted', type: 'weekly_menu', lastError }, 'AI menu generation exhausted all retries');
      throw new Error(`AI menu generation failed after ${MAX_RETRIES} attempts: ${lastError}`);
    },

    async generateAlternatives(
      context: FamilyContext,
      existingRecipeTitles: string[],
      mealType: string,
      log?: FastifyBaseLogger,
    ): Promise<AiRecipe[]> {
      const systemPrompt = buildAlternativesSystemPrompt();
      const userPrompt = JSON.stringify({
        family: context,
        meal_type: mealType,
        existing_recipes_to_avoid: existingRecipeTitles,
      });

      let lastError = '';

      for (let attempt = 1; attempt <= ALTERNATIVES_MAX_RETRIES; attempt++) {
        if (attempt > 1) {
          await sleep(500 * Math.pow(2, attempt - 2)); // 500ms, 1000ms
        }

        log?.info({ event: 'ai_call_started', attempt, type: 'alternatives' }, 'AI call started');
        const callStart = performance.now();
        const raw = await callOpenAI(systemPrompt, userPrompt);
        const durationMs = Math.round(performance.now() - callStart);
        log?.info({ event: 'ai_call_completed', attempt, durationMs, type: 'alternatives' }, 'AI call completed');

        const parsed = parseJson(raw);

        const result = alternativesSchema.safeParse(parsed);
        if (!result.success) {
          lastError = result.error.issues.map((i) => i.message).join('; ');
          log?.warn({ event: 'ai_validation_failed', attempt, step: 'schema', errors: lastError, type: 'alternatives' }, 'AI validation failed');
          continue;
        }

        return result.data.alternatives;
      }

      log?.error({ event: 'ai_generation_exhausted', type: 'alternatives', lastError }, 'AI alternatives generation exhausted all retries');
      throw new Error(
        `AI alternatives generation failed after ${ALTERNATIVES_MAX_RETRIES} attempts: ${lastError}`,
      );
    },
  };
}
