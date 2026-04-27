import { describe, it, expect, beforeEach } from 'vitest';
import { FakeNutritionPlanRepository } from '../FakeNutritionPlanRepository';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

const plan = (): ActiveNutritionPlan => ({
  name: 'Тест',
  calories: 2000,
  proteins: 150,
  fats: 70,
  carbs: 200,
  isCustom: true,
});

describe('FakeNutritionPlanRepository', () => {
  let repo: FakeNutritionPlanRepository;

  beforeEach(() => {
    repo = new FakeNutritionPlanRepository();
  });

  it('get returns null initially', async () => {
    expect(await repo.get()).toBeNull();
  });

  it('set then get returns the plan', async () => {
    await repo.set(plan());
    expect((await repo.get())?.name).toBe('Тест');
  });

  it('set with null clears the plan', async () => {
    await repo.set(plan());
    await repo.set(null);
    expect(await repo.get()).toBeNull();
  });
});
