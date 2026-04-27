// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageNutritionPlanRepository } from '../LocalStorageNutritionPlanRepository';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

const plan = (): ActiveNutritionPlan => ({
  name: 'Похудение',
  calories: 1500,
  proteins: 120,
  fats: 50,
  carbs: 150,
  isCustom: false,
  programId: 'p1',
});

describe('LocalStorageNutritionPlanRepository', () => {
  let repo: LocalStorageNutritionPlanRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageNutritionPlanRepository();
  });

  it('get returns null when localStorage is empty', async () => {
    expect(await repo.get()).toBeNull();
  });

  it('set then get returns the stored plan', async () => {
    await repo.set(plan());
    const result = await repo.get();
    expect(result?.name).toBe('Похудение');
    expect(result?.calories).toBe(1500);
  });

  it('set with null clears the stored plan', async () => {
    await repo.set(plan());
    await repo.set(null);
    expect(await repo.get()).toBeNull();
  });

  it('get returns null on corrupted localStorage data', async () => {
    localStorage.setItem('activeNutritionPlan', 'not-valid-json{{{');
    expect(await repo.get()).toBeNull();
  });
});
