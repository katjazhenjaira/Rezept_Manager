import { createContext, useContext } from 'react';
import type { UserProfile, ActiveNutritionPlan } from '@/shared/domain/types';

export type UserProfileState = {
  userProfile: UserProfile | null;
  saveUserProfile: (profile: UserProfile) => Promise<void>;
};

export type NutritionPlanState = {
  activeNutritionPlan: ActiveNutritionPlan | null;
  setActivePlan: (plan: ActiveNutritionPlan | null) => Promise<void>;
};

export const UserProfileContext = createContext<(UserProfileState & NutritionPlanState) | null>(null);

export function useUserProfile(): UserProfileState {
  const ctx = useContext(UserProfileContext);
  if (ctx === null) throw new Error('useUserProfile must be used within UserProfileProvider');
  return { userProfile: ctx.userProfile, saveUserProfile: ctx.saveUserProfile };
}

export function useNutritionPlan(): NutritionPlanState {
  const ctx = useContext(UserProfileContext);
  if (ctx === null) throw new Error('useNutritionPlan must be used within UserProfileProvider');
  return { activeNutritionPlan: ctx.activeNutritionPlan, setActivePlan: ctx.setActivePlan };
}
