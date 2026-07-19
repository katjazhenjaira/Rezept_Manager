import { useMemo, type ReactNode } from 'react';
import { FirestoreRecipesRepository } from '@/infrastructure/firestore/FirestoreRecipesRepository';
import { FirestorePlannerRepository } from '@/infrastructure/firestore/FirestorePlannerRepository';
import { FirestoreCartRepository } from '@/infrastructure/firestore/FirestoreCartRepository';
import { FirestoreProgramsRepository } from '@/infrastructure/firestore/FirestoreProgramsRepository';
import { FirestoreUserProfileRepository } from '@/infrastructure/firestore/FirestoreUserProfileRepository';
import { FirestoreNutritionPlanRepository } from '@/infrastructure/firestore/FirestoreNutritionPlanRepository';
import { RepositoryContext, type Repositories } from './RepositoryContext';

type Props = {
  uid: string;
  children: ReactNode;
};

export function RepositoryProvider({ uid, children }: Props) {
  const repositories = useMemo<Repositories>(() => ({
    recipes: new FirestoreRecipesRepository(uid),
    planner: new FirestorePlannerRepository(uid),
    cart: new FirestoreCartRepository(uid),
    programs: new FirestoreProgramsRepository(uid),
    userProfile: new FirestoreUserProfileRepository(uid),
    nutritionPlan: new FirestoreNutritionPlanRepository(uid),
  }), [uid]);

  return (
    <RepositoryContext.Provider value={repositories}>
      {children}
    </RepositoryContext.Provider>
  );
}
