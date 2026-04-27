import { useMemo, type ReactNode } from 'react';
import { FirestoreRecipesRepository } from '@/infrastructure/firestore/FirestoreRecipesRepository';
import { FirestorePlannerRepository } from '@/infrastructure/firestore/FirestorePlannerRepository';
import { FirestoreCartRepository } from '@/infrastructure/firestore/FirestoreCartRepository';
import { FirestoreProgramsRepository } from '@/infrastructure/firestore/FirestoreProgramsRepository';
import { FirestoreUserProfileRepository } from '@/infrastructure/firestore/FirestoreUserProfileRepository';
import { FirestoreNutritionPlanRepository } from '@/infrastructure/firestore/FirestoreNutritionPlanRepository';
import { RepositoryContext, type Repositories } from './RepositoryContext';

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const repositories = useMemo<Repositories>(() => ({
    recipes: new FirestoreRecipesRepository(),
    planner: new FirestorePlannerRepository(),
    cart: new FirestoreCartRepository(),
    programs: new FirestoreProgramsRepository(),
    userProfile: new FirestoreUserProfileRepository(),
    nutritionPlan: new FirestoreNutritionPlanRepository(),
  }), []);

  return (
    <RepositoryContext.Provider value={repositories}>
      {children}
    </RepositoryContext.Provider>
  );
}
