import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserProfile, ActiveNutritionPlan } from '@/shared/domain/types';
import { UserProfileContext } from './UserProfileContext';
import { useRepositories } from './RepositoryContext';

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { userProfile: userProfileRepo, nutritionPlan: nutritionPlanRepo } = useRepositories();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeNutritionPlan, setActiveNutritionPlan] = useState<ActiveNutritionPlan | null>(null);

  useEffect(() => {
    return userProfileRepo.subscribe(setUserProfile);
  }, [userProfileRepo]);

  useEffect(() => {
    nutritionPlanRepo.get().then(setActiveNutritionPlan);
  }, [nutritionPlanRepo]);

  const saveUserProfile = useCallback(async (profile: UserProfile) => {
    await userProfileRepo.save(profile);
  }, [userProfileRepo]);

  const setActivePlan = useCallback(async (plan: ActiveNutritionPlan | null) => {
    await nutritionPlanRepo.set(plan);
    setActiveNutritionPlan(plan);
  }, [nutritionPlanRepo]);

  return (
    <UserProfileContext.Provider value={{ userProfile, saveUserProfile, activeNutritionPlan, setActivePlan }}>
      {children}
    </UserProfileContext.Provider>
  );
}
