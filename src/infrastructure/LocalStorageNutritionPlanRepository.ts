import type { NutritionPlanRepository } from '@/services/NutritionPlanRepository';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

const KEY = 'activeNutritionPlan';

export class LocalStorageNutritionPlanRepository implements NutritionPlanRepository {
  async get(): Promise<ActiveNutritionPlan | null> {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as ActiveNutritionPlan;
    } catch {
      return null;
    }
  }

  async set(plan: ActiveNutritionPlan | null): Promise<void> {
    if (plan === null) {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, JSON.stringify(plan));
    }
  }
}
