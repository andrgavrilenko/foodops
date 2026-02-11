import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { AppConfig } from '../config.js';

// Mock OpenAI before importing the module under test
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

// Mock prompt-builder — we only need its return values, not its logic
vi.mock('../lib/prompt-builder.js', () => ({
  buildSystemPrompt: vi.fn().mockReturnValue('system-prompt'),
  buildUserPrompt: vi.fn().mockReturnValue('user-prompt'),
  buildAlternativesSystemPrompt: vi.fn().mockReturnValue('alt-system-prompt'),
}));

// Mock menu-validator — all pass by default, individual tests override
vi.mock('../lib/menu-validator.js', () => ({
  validateMealCount: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  validateRestrictionCompliance: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  validateUniqueness: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  validateCompleteness: vi.fn().mockReturnValue({ valid: true, errors: [] }),
}));

const { createAiMenuGenerator } = await import('../services/ai-menu-generator.js');
const { validateMealCount, validateRestrictionCompliance, validateUniqueness, validateCompleteness } =
  await import('../lib/menu-validator.js');
import type { FamilyContext } from '../lib/prompt-builder.js';

const testConfig: AppConfig = {
  PORT: 3000,
  HOST: '0.0.0.0',
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/testdb',
  CORS_ORIGIN: 'http://localhost:3001',
  JWT_ACCESS_SECRET: 'test-access-secret-must-be-at-least-32-characters-long',
  JWT_REFRESH_SECRET: 'test-refresh-secret-must-be-at-least-32-characters-long',
  JWT_ACCESS_EXPIRY_SECONDS: 300,
  JWT_REFRESH_EXPIRY_DAYS: 7,
  OPENAI_API_KEY: 'test-openai-key',
  OPENAI_MODEL: 'gpt-4o-mini',
};

const minimalContext: FamilyContext = {
  members: [{ role: 'ADULT', age: 30 }],
  servings: 2,
  meals_per_day: 3,
  dietary_restrictions: [],
  medical_restrictions: [],
  cuisines: [],
  excluded_ingredients: [],
  weekly_budget_eur: null,
  calorie_target_per_person: null,
  locked_meals: [],
};

function makeIngredient(name: string) {
  return {
    name_en: name,
    name_fi: `${name}_fi`,
    quantity: 100,
    unit: 'g',
    category: 'produce',
    is_optional: false,
  };
}

function makeRecipe(title: string) {
  return {
    title_en: title,
    title_fi: `${title}_fi`,
    description_en: '',
    description_fi: '',
    cuisine_type: 'international',
    prep_time_min: 30,
    calories_per_serving: 400,
    protein_per_serving: 20,
    carbs_per_serving: 50,
    fat_per_serving: 15,
    tags: [],
    ingredients: [makeIngredient('tomato'), makeIngredient('onion')],
  };
}

function makeValidMenuJson(mealsPerDay = 3): string {
  const mealTypes = ['breakfast', 'lunch', 'dinner'].slice(0, mealsPerDay);
  const days = Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i + 1,
    meals: mealTypes.map((type, j) => ({
      meal_type: type,
      recipe: makeRecipe(`Day${i + 1}-${type}-recipe-${j}`),
    })),
  }));
  return JSON.stringify({ days, total_estimated_cost_eur: 80 });
}

function makeValidAlternativesJson(): string {
  return JSON.stringify({
    alternatives: Array.from({ length: 5 }, (_, i) => makeRecipe(`Alt-${i}`)),
  });
}

function mockOpenAIResponse(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

describe('createAiMenuGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset validators to pass by default
    (validateMealCount as Mock).mockReturnValue({ valid: true, errors: [] });
    (validateRestrictionCompliance as Mock).mockReturnValue({ valid: true, errors: [] });
    (validateUniqueness as Mock).mockReturnValue({ valid: true, errors: [] });
    (validateCompleteness as Mock).mockReturnValue({ valid: true, errors: [] });
  });

  describe('generateWeeklyMenu', () => {
    it('should return a valid menu on successful first attempt', async () => {
      const json = makeValidMenuJson();
      mockCreate.mockResolvedValueOnce(mockOpenAIResponse(json));

      const generator = createAiMenuGenerator(testConfig);
      const result = await generator.generateWeeklyMenu(minimalContext);

      expect(result.days).toHaveLength(7);
      expect(result.days[0]!.meals).toHaveLength(3);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          max_tokens: 8000,
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it('should throw immediately on JSON parse failure (not retried)', async () => {
      // parseJson() throws before the retry-loop continue logic
      mockCreate.mockResolvedValueOnce(mockOpenAIResponse('not valid json {{{'));

      const generator = createAiMenuGenerator(testConfig);
      await expect(generator.generateWeeklyMenu(minimalContext)).rejects.toThrow(
        'AI response is not valid JSON',
      );

      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should retry when Zod schema validation fails and succeed on next attempt', async () => {
      // Zod fails: valid JSON but wrong structure → continues to next attempt
      const invalidMenu = JSON.stringify({ days: [] }); // length !== 7
      mockCreate
        .mockResolvedValueOnce(mockOpenAIResponse(invalidMenu))
        .mockResolvedValueOnce(mockOpenAIResponse(makeValidMenuJson()));

      const generator = createAiMenuGenerator(testConfig);
      const result = await generator.generateWeeklyMenu(minimalContext);

      expect(result.days).toHaveLength(7);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should throw after MAX_RETRIES (3) when Zod validation keeps failing', async () => {
      // Valid JSON but wrong structure each time
      const invalidMenu = JSON.stringify({ days: [] });
      mockCreate.mockResolvedValue(mockOpenAIResponse(invalidMenu));

      const generator = createAiMenuGenerator(testConfig);
      await expect(generator.generateWeeklyMenu(minimalContext)).rejects.toThrow(
        /AI menu generation failed after 3 attempts/,
      );

      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should retry when meal count validation fails', async () => {
      const validJson = makeValidMenuJson();
      mockCreate
        .mockResolvedValueOnce(mockOpenAIResponse(validJson))
        .mockResolvedValueOnce(mockOpenAIResponse(validJson));

      (validateMealCount as Mock)
        .mockReturnValueOnce({ valid: false, errors: ['Day 1: expected 3 meals, got 2'] })
        .mockReturnValueOnce({ valid: true, errors: [] });

      const generator = createAiMenuGenerator(testConfig);
      const result = await generator.generateWeeklyMenu(minimalContext);

      expect(result.days).toHaveLength(7);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should retry when restriction compliance fails', async () => {
      const contextWithRestriction: FamilyContext = {
        ...minimalContext,
        dietary_restrictions: [
          { member_label: 'Member 1', type: 'ALLERGY', value: 'peanuts', severity: 'strict' },
        ],
      };

      const validJson = makeValidMenuJson();
      mockCreate
        .mockResolvedValueOnce(mockOpenAIResponse(validJson))
        .mockResolvedValueOnce(mockOpenAIResponse(validJson));

      (validateRestrictionCompliance as Mock)
        .mockReturnValueOnce({ valid: false, errors: ['contains peanuts'] })
        .mockReturnValueOnce({ valid: true, errors: [] });

      const generator = createAiMenuGenerator(testConfig);
      const result = await generator.generateWeeklyMenu(contextWithRestriction);

      expect(result.days).toHaveLength(7);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should retry when uniqueness validation fails', async () => {
      const validJson = makeValidMenuJson();
      mockCreate
        .mockResolvedValueOnce(mockOpenAIResponse(validJson))
        .mockResolvedValueOnce(mockOpenAIResponse(validJson));

      (validateUniqueness as Mock)
        .mockReturnValueOnce({ valid: false, errors: ['duplicate recipe'] })
        .mockReturnValueOnce({ valid: true, errors: [] });

      const generator = createAiMenuGenerator(testConfig);
      const result = await generator.generateWeeklyMenu(minimalContext);

      expect(result.days).toHaveLength(7);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should retry when completeness validation fails', async () => {
      const validJson = makeValidMenuJson();
      mockCreate
        .mockResolvedValueOnce(mockOpenAIResponse(validJson))
        .mockResolvedValueOnce(mockOpenAIResponse(validJson));

      (validateCompleteness as Mock)
        .mockReturnValueOnce({ valid: false, errors: ['missing title'] })
        .mockReturnValueOnce({ valid: true, errors: [] });

      const generator = createAiMenuGenerator(testConfig);
      const result = await generator.generateWeeklyMenu(minimalContext);

      expect(result.days).toHaveLength(7);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should propagate OpenAI API errors directly (429)', async () => {
      mockCreate.mockRejectedValueOnce(new Error('429 Rate limit exceeded'));

      const generator = createAiMenuGenerator(testConfig);
      await expect(generator.generateWeeklyMenu(minimalContext)).rejects.toThrow(
        '429 Rate limit exceeded',
      );

      // API errors propagate immediately — not caught by retry loop
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should propagate OpenAI API errors directly (500)', async () => {
      mockCreate.mockRejectedValueOnce(new Error('500 Internal Server Error'));

      const generator = createAiMenuGenerator(testConfig);
      await expect(generator.generateWeeklyMenu(minimalContext)).rejects.toThrow(
        '500 Internal Server Error',
      );
    });

    it('should include retry error context in the prompt on subsequent attempts', async () => {
      // First attempt: Zod schema fails (valid JSON but wrong structure); second: succeeds
      const invalidMenu = JSON.stringify({ days: [] });
      mockCreate
        .mockResolvedValueOnce(mockOpenAIResponse(invalidMenu))
        .mockResolvedValueOnce(mockOpenAIResponse(makeValidMenuJson()));

      const generator = createAiMenuGenerator(testConfig);
      await generator.generateWeeklyMenu(minimalContext);

      // Second call should include PREVIOUS ATTEMPT FAILED context
      const secondCall = mockCreate.mock.calls[1]![0] as {
        messages: { role: string; content: string }[];
      };
      const userMessage = secondCall.messages.find((m) => m.role === 'user');
      expect(userMessage!.content).toContain('PREVIOUS ATTEMPT FAILED');
    });

    it('should throw on empty/null response content from OpenAI', async () => {
      // null content → '' via ?? '' → JSON.parse('') throws immediately
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });

      const generator = createAiMenuGenerator(testConfig);
      await expect(generator.generateWeeklyMenu(minimalContext)).rejects.toThrow(
        'AI response is not valid JSON',
      );
    });

    it('should throw on missing choices from OpenAI', async () => {
      mockCreate.mockResolvedValueOnce({ choices: [] });

      const generator = createAiMenuGenerator(testConfig);
      // undefined?.message?.content ?? '' → '' → JSON.parse('') throws
      await expect(generator.generateWeeklyMenu(minimalContext)).rejects.toThrow(
        'AI response is not valid JSON',
      );
    });

    it('should pass AbortSignal.timeout(30000) to OpenAI SDK', async () => {
      mockCreate.mockResolvedValueOnce(mockOpenAIResponse(makeValidMenuJson()));

      const generator = createAiMenuGenerator(testConfig);
      await generator.generateWeeklyMenu(minimalContext);

      const options = mockCreate.mock.calls[0]![1] as { signal: AbortSignal };
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    it('should only filter strict-severity restrictions for compliance check', async () => {
      const contextMixed: FamilyContext = {
        ...minimalContext,
        dietary_restrictions: [
          { member_label: 'Member 1', type: 'ALLERGY', value: 'peanuts', severity: 'strict' },
          { member_label: 'Member 1', type: 'PREFERENCE', value: 'dairy', severity: 'mild' },
        ],
      };

      mockCreate.mockResolvedValueOnce(mockOpenAIResponse(makeValidMenuJson()));

      const generator = createAiMenuGenerator(testConfig);
      await generator.generateWeeklyMenu(contextMixed);

      // validateRestrictionCompliance should only receive the strict restriction
      expect(validateRestrictionCompliance).toHaveBeenCalledWith(
        expect.anything(),
        [{ value: 'peanuts' }],
      );
    });
  });

  describe('generateAlternatives', () => {
    it('should return alternatives on successful first attempt', async () => {
      mockCreate.mockResolvedValueOnce(mockOpenAIResponse(makeValidAlternativesJson()));

      const generator = createAiMenuGenerator(testConfig);
      const result = await generator.generateAlternatives(minimalContext, ['Existing Recipe'], 'lunch');

      expect(result).toHaveLength(5);
      expect(result[0]!.title_en).toBe('Alt-0');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should use ALTERNATIVES_MAX_RETRIES (2) when Zod validation fails', async () => {
      // Valid JSON but empty alternatives array → min(1) fails → retry with continue
      const emptyAlternatives = JSON.stringify({ alternatives: [] });
      mockCreate.mockResolvedValue(mockOpenAIResponse(emptyAlternatives));

      const generator = createAiMenuGenerator(testConfig);
      await expect(
        generator.generateAlternatives(minimalContext, [], 'dinner'),
      ).rejects.toThrow(/AI alternatives generation failed after 2 attempts/);

      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should throw immediately on JSON parse failure (not retried)', async () => {
      mockCreate.mockResolvedValueOnce(mockOpenAIResponse('not json'));

      const generator = createAiMenuGenerator(testConfig);
      await expect(
        generator.generateAlternatives(minimalContext, [], 'dinner'),
      ).rejects.toThrow('AI response is not valid JSON');

      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should retry with backoff on Zod validation failure', async () => {
      const invalidAlt = JSON.stringify({ alternatives: [] }); // min(1) fails
      mockCreate
        .mockResolvedValueOnce(mockOpenAIResponse(invalidAlt))
        .mockResolvedValueOnce(mockOpenAIResponse(makeValidAlternativesJson()));

      const generator = createAiMenuGenerator(testConfig);
      const start = Date.now();
      const result = await generator.generateAlternatives(minimalContext, [], 'breakfast');

      expect(result).toHaveLength(5);
      expect(mockCreate).toHaveBeenCalledTimes(2);
      // Second attempt should have a backoff delay (500ms minimum)
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(400); // allow some tolerance
    });

    it('should propagate OpenAI API errors directly', async () => {
      mockCreate.mockRejectedValueOnce(new Error('429 Rate limit exceeded'));

      const generator = createAiMenuGenerator(testConfig);
      await expect(
        generator.generateAlternatives(minimalContext, [], 'lunch'),
      ).rejects.toThrow('429 Rate limit exceeded');
    });

    it('should pass family context and existing recipes in user prompt', async () => {
      mockCreate.mockResolvedValueOnce(mockOpenAIResponse(makeValidAlternativesJson()));

      const generator = createAiMenuGenerator(testConfig);
      await generator.generateAlternatives(minimalContext, ['Pasta Bolognese', 'Salmon Soup'], 'lunch');

      const requestBody = mockCreate.mock.calls[0]![0] as {
        messages: { role: string; content: string }[];
      };
      const userMessage = requestBody.messages.find((m) => m.role === 'user');
      const parsed = JSON.parse(userMessage!.content);
      expect(parsed.meal_type).toBe('lunch');
      expect(parsed.existing_recipes_to_avoid).toEqual(['Pasta Bolognese', 'Salmon Soup']);
    });
  });
});
