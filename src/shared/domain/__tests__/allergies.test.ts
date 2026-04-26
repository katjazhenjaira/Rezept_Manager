import { describe, it, expect } from 'vitest';
import { recipeAllergens, recipeHasAllergens } from '../allergies';
import type { Recipe } from '../types';

const makeRecipe = (ingredients: string[]): Recipe => ({
  id: 'r1',
  title: 'Тест',
  time: '10 мин',
  servings: 1,
  categories: [],
  ingredients,
  steps: [],
  macros: { calories: 0, proteins: 0, fats: 0, carbs: 0 },
  createdAt: '2026-01-01',
});

describe('recipeAllergens', () => {
  it('returns empty array when allergies list is empty', () => {
    const recipe = makeRecipe(['яйца', 'молоко', 'мука']);
    expect(recipeAllergens(recipe, [])).toEqual([]);
  });

  it('returns empty array when no ingredient matches any allergy', () => {
    const recipe = makeRecipe(['куриная грудка', 'рис', 'перец']);
    expect(recipeAllergens(recipe, ['Орехи', 'Лактоза'])).toEqual([]);
  });

  it('returns matching allergen when ingredient contains allergy substring', () => {
    const recipe = makeRecipe(['грецкие орехи', 'сахар', 'масло']);
    expect(recipeAllergens(recipe, ['Орехи'])).toEqual(['Орехи']);
  });

  it('is case-insensitive on both allergy and ingredient', () => {
    const recipe = makeRecipe(['Куриное ЯЙЦО', 'мука']);
    expect(recipeAllergens(recipe, ['яйцо'])).toEqual(['яйцо']);
  });

  it('returns multiple matching allergens', () => {
    const recipe = makeRecipe(['молоко', 'яйца свежие']);
    expect(recipeAllergens(recipe, ['молоко', 'яйца'])).toEqual(['молоко', 'яйца']);
  });

  it('returns allergen when ingredient exactly equals allergy (case-insensitive)', () => {
    const recipe = makeRecipe(['молоко', 'сахар']);
    expect(recipeAllergens(recipe, ['Молоко'])).toEqual(['Молоко']);
  });

  it('returns allergen when allergy appears as substring within a compound ingredient name', () => {
    const recipe = makeRecipe(['молоко цельное', 'рис']);
    expect(recipeAllergens(recipe, ['молоко'])).toEqual(['молоко']);
  });
});

describe('recipeHasAllergens', () => {
  it('returns false when no allergens match', () => {
    const recipe = makeRecipe(['куриная грудка', 'рис']);
    expect(recipeHasAllergens(recipe, ['Орехи', 'Лактоза'])).toBe(false);
  });

  it('returns true when at least one allergen matches', () => {
    const recipe = makeRecipe(['грецкие орехи', 'мёд']);
    expect(recipeHasAllergens(recipe, ['Орехи'])).toBe(true);
  });

  it('returns false for empty allergies list', () => {
    const recipe = makeRecipe(['молоко', 'яйца']);
    expect(recipeHasAllergens(recipe, [])).toBe(false);
  });
});
