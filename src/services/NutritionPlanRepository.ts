import type { ActiveNutritionPlan } from '@/shared/domain/types';

export interface NutritionPlanRepository {
  get(): Promise<ActiveNutritionPlan | null>;
  set(plan: ActiveNutritionPlan | null): Promise<void>;
}
