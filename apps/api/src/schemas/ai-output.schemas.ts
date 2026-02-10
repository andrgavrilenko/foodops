import { z } from 'zod';

export const aiIngredientSchema = z.object({
  name_en: z.string().min(1),
  name_fi: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  category: z.string().min(1),
  is_optional: z.boolean().default(false),
});

export const aiRecipeSchema = z.object({
  title_en: z.string().min(1),
  title_fi: z.string().min(1),
  description_en: z.string().optional().default(''),
  description_fi: z.string().optional().default(''),
  cuisine_type: z.string().optional().default('international'),
  prep_time_min: z.number().int().positive().max(180).default(30),
  calories_per_serving: z.number().int().positive(),
  protein_per_serving: z.number().nonnegative().default(0),
  carbs_per_serving: z.number().nonnegative().default(0),
  fat_per_serving: z.number().nonnegative().default(0),
  tags: z.array(z.string()).default([]),
  ingredients: z.array(aiIngredientSchema).min(2),
});

export const aiMealSchema = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner']),
  recipe: aiRecipeSchema,
});

export const aiDaySchema = z.object({
  day_of_week: z.number().int().min(1).max(7),
  meals: z.array(aiMealSchema).min(2).max(3),
});

export const aiMenuResponseSchema = z.object({
  days: z.array(aiDaySchema).length(7),
  total_estimated_cost_eur: z.number().nonnegative().optional().default(0),
});

export type AiIngredient = z.infer<typeof aiIngredientSchema>;
export type AiRecipe = z.infer<typeof aiRecipeSchema>;
export type AiMeal = z.infer<typeof aiMealSchema>;
export type AiDay = z.infer<typeof aiDaySchema>;
export type AiMenuResponse = z.infer<typeof aiMenuResponseSchema>;
