import { describe, it, expect } from 'vitest';
import {
  validateRestrictionCompliance,
  validateUniqueness,
  validateCompleteness,
  validateMealCount,
} from '../lib/menu-validator.js';
import type { AiMenuResponse } from '../schemas/ai-output.schemas.js';

function makeMenu(overrides?: Partial<AiMenuResponse>): AiMenuResponse {
  const base: AiMenuResponse = {
    days: Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i + 1,
      meals: [
        {
          meal_type: 'lunch' as const,
          recipe: {
            title_en: `Recipe ${i + 1}a`,
            title_fi: `Resepti ${i + 1}a`,
            description_en: '',
            description_fi: '',
            cuisine_type: 'finnish',
            prep_time_min: 30,
            calories_per_serving: 400,
            protein_per_serving: 20,
            carbs_per_serving: 50,
            fat_per_serving: 15,
            tags: [],
            ingredients: [
              {
                name_en: 'Potato',
                name_fi: 'Peruna',
                quantity: 200,
                unit: 'g',
                category: 'vegetables',
                is_optional: false,
              },
              {
                name_en: 'Butter',
                name_fi: 'Voi',
                quantity: 20,
                unit: 'g',
                category: 'dairy',
                is_optional: false,
              },
            ],
          },
        },
        {
          meal_type: 'dinner' as const,
          recipe: {
            title_en: `Recipe ${i + 1}b`,
            title_fi: `Resepti ${i + 1}b`,
            description_en: '',
            description_fi: '',
            cuisine_type: 'italian',
            prep_time_min: 45,
            calories_per_serving: 500,
            protein_per_serving: 25,
            carbs_per_serving: 60,
            fat_per_serving: 20,
            tags: [],
            ingredients: [
              {
                name_en: 'Pasta',
                name_fi: 'Pasta',
                quantity: 150,
                unit: 'g',
                category: 'grains',
                is_optional: false,
              },
              {
                name_en: 'Tomato',
                name_fi: 'Tomaatti',
                quantity: 100,
                unit: 'g',
                category: 'vegetables',
                is_optional: false,
              },
            ],
          },
        },
      ],
    })),
    total_estimated_cost_eur: 120,
  };

  return { ...base, ...overrides };
}

describe('Menu Validator', () => {
  describe('validateRestrictionCompliance', () => {
    it('should pass with no restrictions', () => {
      const result = validateRestrictionCompliance(makeMenu(), []);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect forbidden ingredients', () => {
      const result = validateRestrictionCompliance(makeMenu(), [{ value: 'butter' }]);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Butter');
    });

    it('should pass when no ingredient matches', () => {
      const result = validateRestrictionCompliance(makeMenu(), [{ value: 'peanut' }]);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateUniqueness', () => {
    it('should pass with unique recipes', () => {
      const result = validateUniqueness(makeMenu());
      expect(result.valid).toBe(true);
    });

    it('should detect duplicates', () => {
      const menu = makeMenu();
      // Make day 2 lunch same as day 1 lunch
      menu.days[1]!.meals[0]!.recipe.title_en = menu.days[0]!.meals[0]!.recipe.title_en;

      const result = validateUniqueness(menu);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('duplicate');
    });
  });

  describe('validateCompleteness', () => {
    it('should pass with complete recipes', () => {
      const result = validateCompleteness(makeMenu());
      expect(result.valid).toBe(true);
    });

    it('should detect recipes with too few ingredients', () => {
      const menu = makeMenu();
      menu.days[0]!.meals[0]!.recipe.ingredients = [
        {
          name_en: 'Salt',
          name_fi: 'Suola',
          quantity: 5,
          unit: 'g',
          category: 'seasoning',
          is_optional: false,
        },
      ];

      const result = validateCompleteness(menu);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('fewer than 2 ingredients');
    });

    it('should detect zero calories', () => {
      const menu = makeMenu();
      menu.days[0]!.meals[0]!.recipe.calories_per_serving = 0;

      const result = validateCompleteness(menu);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('invalid calories');
    });
  });

  describe('validateMealCount', () => {
    it('should pass with correct meal count', () => {
      const result = validateMealCount(makeMenu(), 2);
      expect(result.valid).toBe(true);
    });

    it('should fail with wrong meal count', () => {
      const result = validateMealCount(makeMenu(), 3);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('expected 3 meals, got 2');
    });
  });
});
