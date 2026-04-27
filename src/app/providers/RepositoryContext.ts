import { createContext, useContext } from 'react';
import type { RecipesRepository } from '@/services/RecipesRepository';
import type { PlannerRepository } from '@/services/PlannerRepository';
import type { CartRepository } from '@/services/CartRepository';
import type { ProgramsRepository } from '@/services/ProgramsRepository';
import type { UserProfileRepository } from '@/services/UserProfileRepository';
import type { NutritionPlanRepository } from '@/services/NutritionPlanRepository';

export type Repositories = {
  recipes: RecipesRepository;
  planner: PlannerRepository;
  cart: CartRepository;
  programs: ProgramsRepository;
  userProfile: UserProfileRepository;
  nutritionPlan: NutritionPlanRepository;
};

export const RepositoryContext = createContext<Repositories | null>(null);

export function useRepositories(): Repositories {
  const ctx = useContext(RepositoryContext);
  if (ctx === null) throw new Error('useRepositories must be used within RepositoryProvider');
  return ctx;
}
