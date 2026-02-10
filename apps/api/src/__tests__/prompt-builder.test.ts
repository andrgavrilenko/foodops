import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, type FamilyContext } from '../lib/prompt-builder.js';

function makeContext(overrides?: Partial<FamilyContext>): FamilyContext {
  return {
    members: [
      { role: 'adult', age: 35 },
      { role: 'child', age: 8 },
    ],
    servings: 2,
    meals_per_day: 3,
    dietary_restrictions: [],
    medical_restrictions: [],
    cuisines: ['finnish'],
    excluded_ingredients: [],
    weekly_budget_eur: null,
    calorie_target_per_person: null,
    locked_meals: [],
    ...overrides,
  };
}

describe('Prompt Builder', () => {
  describe('buildSystemPrompt', () => {
    it('should include meals_per_day', () => {
      const prompt = buildSystemPrompt(3);
      expect(prompt).toContain('exactly 3 meals per day');
    });

    it('should include JSON schema instructions', () => {
      const prompt = buildSystemPrompt(2);
      expect(prompt).toContain('Respond ONLY with valid JSON');
      expect(prompt).toContain('day_of_week');
    });
  });

  describe('buildUserPrompt', () => {
    it('should anonymize members (no real names)', () => {
      const prompt = buildUserPrompt(makeContext());
      expect(prompt).not.toContain('John');
      expect(prompt).toContain('Member 1');
      expect(prompt).toContain('Member 2');
    });

    it('should include dietary restrictions', () => {
      const prompt = buildUserPrompt(
        makeContext({
          dietary_restrictions: [
            {
              member_label: 'Member 1 (adult, 35)',
              type: 'allergy',
              value: 'nuts',
              severity: 'strict',
            },
          ],
        }),
      );
      expect(prompt).toContain('nuts');
      expect(prompt).toContain('allergy');
    });

    it('should include medical restrictions', () => {
      const prompt = buildUserPrompt(
        makeContext({
          medical_restrictions: [{ member_label: 'Member 1 (adult, 35)', condition: 'diabetes' }],
        }),
      );
      expect(prompt).toContain('diabetes');
    });

    it('should include budget when provided', () => {
      const prompt = buildUserPrompt(
        makeContext({ weekly_budget_eur: 150, calorie_target_per_person: 2000 }),
      );
      expect(prompt).toContain('150');
      expect(prompt).toContain('2000');
    });

    it('should include locked meals', () => {
      const prompt = buildUserPrompt(
        makeContext({
          locked_meals: [{ day: 1, meal_type: 'lunch', recipe_title: 'Pasta Bolognese' }],
        }),
      );
      expect(prompt).toContain('Pasta Bolognese');
      expect(prompt).toContain('locked');
    });

    it('should include preferences', () => {
      const prompt = buildUserPrompt(
        makeContext({
          cuisines: ['finnish', 'italian'],
          excluded_ingredients: ['cilantro'],
        }),
      );
      expect(prompt).toContain('finnish');
      expect(prompt).toContain('italian');
      expect(prompt).toContain('cilantro');
    });
  });
});
