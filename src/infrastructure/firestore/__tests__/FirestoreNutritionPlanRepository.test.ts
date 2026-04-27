// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';

// FirestoreNutritionPlanRepository cannot be unit-tested without the Firebase emulator,
// so this tests the contract via the fake to confirm the interface is consistent.
describe('NutritionPlanRepository contract', () => {
  let repo: FakeNutritionPlanRepository;

  beforeEach(() => {
    repo = new FakeNutritionPlanRepository();
  });

  it('returns null when nothing stored', async () => {
    expect(await repo.get()).toBeNull();
  });

  it('persists and retrieves a plan', async () => {
    const plan = {
      name: 'Test',
      calories: 1800,
      proteins: 100,
      fats: 60,
      carbs: 200,
      isCustom: false,
      allowedProducts: [],
      forbiddenProducts: [],
    };
    await repo.set(plan);
    expect(await repo.get()).toEqual(plan);
  });

  it('clears plan when set(null) is called', async () => {
    await repo.set({
      name: 'Test',
      calories: 1800,
      proteins: 100,
      fats: 60,
      carbs: 200,
      isCustom: false,
      allowedProducts: [],
      forbiddenProducts: [],
    });
    await repo.set(null);
    expect(await repo.get()).toBeNull();
  });
});
