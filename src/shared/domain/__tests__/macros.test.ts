import { describe, it, expect } from 'vitest';
import { sumMacros, remainingMacros, resolveActiveTargets } from '../macros';
import type { PlannerEntry, Recipe, UserProfile, ActiveNutritionPlan } from '../types';

const baseProfile: UserProfile = {
  name: 'Test',
  age: 30,
  gender: 'female',
  currentWeight: 65,
  targetWeight: 60,
  targetCalories: 2000,
  targetProteins: 120,
  targetFats: 60,
  targetCarbs: 250,
  waterGoal: 2000,
  allergies: [],
};

const recipeA: Recipe = {
  id: 'r1',
  title: 'Овсянка',
  time: '10 мин',
  servings: 1,
  categories: [],
  ingredients: ['овсянка', 'молоко'],
  steps: [],
  macros: { calories: 300, proteins: 10, fats: 5, carbs: 55 },
  createdAt: '2026-01-01',
};

const recipeB: Recipe = {
  id: 'r2',
  title: 'Омлет',
  time: '15 мин',
  servings: 1,
  categories: [],
  ingredients: ['яйца', 'масло'],
  steps: [],
  macros: { calories: 200, proteins: 15, fats: 14, carbs: 2 },
  createdAt: '2026-01-01',
};

describe('sumMacros', () => {
  it('returns zeros for empty entries', () => {
    expect(sumMacros([], [])).toEqual({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
  });

  it('sums macros for a recipe entry', () => {
    const entry: PlannerEntry = { id: 'e1', date: '2026-01-01', mealType: 'Завтрак', type: 'recipe', recipeId: 'r1' };
    expect(sumMacros([entry], [recipeA, recipeB])).toEqual({ calories: 300, proteins: 10, fats: 5, carbs: 55 });
  });

  it('sums macros for a product entry with inline macros', () => {
    const entry: PlannerEntry = {
      id: 'e2', date: '2026-01-01', mealType: 'Обед', type: 'product',
      macros: { calories: 150, proteins: 5, fats: 3, carbs: 25 },
    };
    expect(sumMacros([entry], [])).toEqual({ calories: 150, proteins: 5, fats: 3, carbs: 25 });
  });

  it('accumulates multiple entries', () => {
    const entries: PlannerEntry[] = [
      { id: 'e1', date: '2026-01-01', mealType: 'Завтрак', type: 'recipe', recipeId: 'r1' },
      { id: 'e2', date: '2026-01-01', mealType: 'Обед', type: 'recipe', recipeId: 'r2' },
    ];
    expect(sumMacros(entries, [recipeA, recipeB])).toEqual({
      calories: 500, proteins: 25, fats: 19, carbs: 57,
    });
  });

  it('ignores recipe entries whose recipeId has no match', () => {
    const entry: PlannerEntry = { id: 'e1', date: '2026-01-01', mealType: 'Завтрак', type: 'recipe', recipeId: 'missing' };
    expect(sumMacros([entry], [recipeA])).toEqual({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
  });

  it('ignores product entries with no macros field', () => {
    const entry: PlannerEntry = { id: 'e1', date: '2026-01-01', mealType: 'Завтрак', type: 'product' };
    expect(sumMacros([entry], [])).toEqual({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
  });
});

describe('remainingMacros', () => {
  it('returns positive difference when targets exceed actual', () => {
    const targets = { calories: 2000, proteins: 120, fats: 60, carbs: 250 };
    const actual = { calories: 500, proteins: 30, fats: 15, carbs: 60 };
    expect(remainingMacros(targets, actual)).toEqual({ calories: 1500, proteins: 90, fats: 45, carbs: 190 });
  });

  it('clamps to zero when actual exceeds targets', () => {
    const targets = { calories: 500, proteins: 30, fats: 15, carbs: 60 };
    const actual = { calories: 600, proteins: 40, fats: 20, carbs: 80 };
    expect(remainingMacros(targets, actual)).toEqual({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
  });

  it('returns zeros when targets equal actual', () => {
    const macros = { calories: 2000, proteins: 120, fats: 60, carbs: 250 };
    expect(remainingMacros(macros, macros)).toEqual({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
  });
});

describe('resolveActiveTargets', () => {
  it('falls back to profile defaults when plan is null', () => {
    const result = resolveActiveTargets(null, baseProfile);
    expect(result).toEqual({
      name: 'По умолчанию (из настроек)',
      calories: 2000,
      proteins: 120,
      fats: 60,
      carbs: 250,
      allowedProducts: [],
      forbiddenProducts: [],
    });
  });

  it('uses plan values when plan is provided', () => {
    const plan: ActiveNutritionPlan = {
      name: 'Похудение',
      calories: 1500,
      proteins: 100,
      fats: 50,
      carbs: 180,
      isCustom: false,
      allowedProducts: ['куриная грудка'],
      forbiddenProducts: ['сахар'],
    };
    const result = resolveActiveTargets(plan, baseProfile);
    expect(result).toEqual({
      name: 'Похудение',
      calories: 1500,
      proteins: 100,
      fats: 50,
      carbs: 180,
      allowedProducts: ['куриная грудка'],
      forbiddenProducts: ['сахар'],
    });
  });

  it('defaults allowedProducts/forbiddenProducts to empty arrays when plan omits them', () => {
    const plan: ActiveNutritionPlan = {
      name: 'Без ограничений',
      calories: 2000,
      proteins: 120,
      fats: 60,
      carbs: 250,
      isCustom: true,
    };
    const result = resolveActiveTargets(plan, baseProfile);
    expect(result.allowedProducts).toEqual([]);
    expect(result.forbiddenProducts).toEqual([]);
  });
});
