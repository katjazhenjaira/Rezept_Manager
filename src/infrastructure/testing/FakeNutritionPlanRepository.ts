import type { NutritionPlanRepository } from '@/services/NutritionPlanRepository';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

export class FakeNutritionPlanRepository implements NutritionPlanRepository {
  private current: ActiveNutritionPlan | null = null;

  async get(): Promise<ActiveNutritionPlan | null> {
    return this.current;
  }

  async set(plan: ActiveNutritionPlan | null): Promise<void> {
    this.current = plan;
  }

  reset(): void {
    this.current = null;
  }
}
