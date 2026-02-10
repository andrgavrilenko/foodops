function sanitizeUserInput(input: string): string {
  // eslint-disable-next-line no-control-regex
  const controlChars = /[\x00-\x1f\x7f]/g;
  return input.replace(controlChars, '').replace(/[<>]/g, '').slice(0, 500);
}

export interface FamilyContext {
  members: { role: string; age: number }[];
  servings: number;
  meals_per_day: number;
  dietary_restrictions: { member_label: string; type: string; value: string; severity: string }[];
  medical_restrictions: { member_label: string; condition: string }[];
  cuisines: string[];
  excluded_ingredients: string[];
  weekly_budget_eur: number | null;
  calorie_target_per_person: number | null;
  locked_meals: { day: number; meal_type: string; recipe_title: string }[];
}

export function buildSystemPrompt(mealsPerDay: number): string {
  return `You are a professional family nutritionist and chef specializing in Finnish and international cuisine.
Your task is to generate a weekly meal plan for a family living in Finland.

Rules:
1. Generate exactly ${mealsPerDay} meals per day for 7 days (Monday through Sunday).
2. Each meal must have a unique recipe — no repeated main dishes within the same week.
3. All recipes must be safe for ALL family members considering their dietary and medical restrictions.
4. Ingredients must be commonly available in Finnish grocery stores (S-Market / S-kaupat.fi).
5. Recipes should be practical for home cooking with prep time under 60 minutes.
6. Provide both English and Finnish names for each recipe and ingredient.
7. If a weekly budget is specified, optimize total ingredient cost to stay within budget.
8. If a calorie target is specified, aim for ±20% of the target per person per day.
9. Respond ONLY with valid JSON matching the exact schema provided below.

JSON Schema:
{
  "days": [
    {
      "day_of_week": 1,
      "meals": [
        {
          "meal_type": "breakfast" | "lunch" | "dinner",
          "recipe": {
            "title_en": "string",
            "title_fi": "string",
            "description_en": "string",
            "description_fi": "string",
            "cuisine_type": "string",
            "prep_time_min": number,
            "calories_per_serving": number,
            "protein_per_serving": number,
            "carbs_per_serving": number,
            "fat_per_serving": number,
            "tags": ["string"],
            "ingredients": [
              {
                "name_en": "string",
                "name_fi": "string",
                "quantity": number,
                "unit": "string (g, ml, pcs, tbsp, tsp)",
                "category": "string",
                "is_optional": boolean
              }
            ]
          }
        }
      ]
    }
  ],
  "total_estimated_cost_eur": number
}`;
}

export function buildUserPrompt(context: FamilyContext): string {
  const prompt: Record<string, unknown> = {
    family: {
      members: context.members.map((m, i) => ({
        label: `Member ${i + 1} (${m.role}, ${m.age})`,
        role: m.role,
        age: m.age,
      })),
      servings: context.servings,
      meals_per_day: context.meals_per_day,
    },
    restrictions: {
      dietary: context.dietary_restrictions.map((r) => ({
        member: sanitizeUserInput(r.member_label),
        type: sanitizeUserInput(r.type),
        value: sanitizeUserInput(r.value),
        severity: r.severity,
      })),
      medical: context.medical_restrictions.map((r) => ({
        member: sanitizeUserInput(r.member_label),
        condition: sanitizeUserInput(r.condition),
      })),
    },
    preferences: {
      cuisines: context.cuisines.map(sanitizeUserInput),
      excluded_ingredients: context.excluded_ingredients.map(sanitizeUserInput),
    },
  };

  if (context.weekly_budget_eur || context.calorie_target_per_person) {
    prompt['budget'] = {
      weekly_budget_eur: context.weekly_budget_eur,
      calorie_target_per_person: context.calorie_target_per_person,
    };
  }

  if (context.locked_meals.length > 0) {
    prompt['locked_meals'] = context.locked_meals.map((m) => ({
      day: m.day,
      meal_type: m.meal_type,
      recipe_title: m.recipe_title,
      note: 'This meal is locked. Do NOT generate a recipe for this slot.',
    }));
  }

  return JSON.stringify(prompt, null, 2);
}

export function buildAlternativesSystemPrompt(): string {
  return `You are a professional family nutritionist and chef specializing in Finnish and international cuisine.
Generate 5 alternative recipe suggestions for a specific meal slot in a weekly menu.

Rules:
1. All recipes must be safe for ALL family members considering their dietary and medical restrictions.
2. Ingredients must be commonly available in Finnish grocery stores (S-Market / S-kaupat.fi).
3. Recipes should be practical for home cooking with prep time under 60 minutes.
4. Provide both English and Finnish names for each recipe and ingredient.
5. Do NOT suggest recipes that already appear in the current menu.
6. Respond ONLY with valid JSON: { "alternatives": [ ...recipe objects ] }

Recipe object schema (same as in menu generation):
{
  "title_en": "string",
  "title_fi": "string",
  "description_en": "string",
  "description_fi": "string",
  "cuisine_type": "string",
  "prep_time_min": number,
  "calories_per_serving": number,
  "protein_per_serving": number,
  "carbs_per_serving": number,
  "fat_per_serving": number,
  "tags": ["string"],
  "ingredients": [
    {
      "name_en": "string",
      "name_fi": "string",
      "quantity": number,
      "unit": "string",
      "category": "string",
      "is_optional": boolean
    }
  ]
}`;
}
