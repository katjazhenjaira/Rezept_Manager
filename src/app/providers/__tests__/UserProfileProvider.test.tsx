// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { UserProfileProvider } from '../UserProfileProvider';
import { useUserProfile, useNutritionPlan } from '../UserProfileContext';
import { RepositoryContext, type Repositories } from '../RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';

const DEFAULT_PROFILE = {
  name: '',
  age: 30,
  gender: 'female' as const,
  currentWeight: 65,
  targetWeight: 60,
  targetCalories: 1800,
  targetProteins: 100,
  targetFats: 60,
  targetCarbs: 200,
  waterGoal: 2000,
  allergies: [],
};

function makeRepos(): Repositories & {
  userProfile: FakeUserProfileRepository;
  nutritionPlan: FakeNutritionPlanRepository;
} {
  return {
    recipes: new FakeRecipesRepository(),
    planner: new FakePlannerRepository(),
    cart: new FakeCartRepository(),
    programs: new FakeProgramsRepository(),
    userProfile: new FakeUserProfileRepository(),
    nutritionPlan: new FakeNutritionPlanRepository(),
  };
}

function makeWrapper(repos: Repositories) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RepositoryContext.Provider value={repos}>
        <UserProfileProvider>{children}</UserProfileProvider>
      </RepositoryContext.Provider>
    );
  };
}

describe('useUserProfile', () => {
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
  });

  it('starts with null profile', () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper: makeWrapper(repos) });
    expect(result.current.userProfile).toBeNull();
  });

  it('reflects profile saved to the repository', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper: makeWrapper(repos) });
    await act(async () => {
      await repos.userProfile.save({ ...DEFAULT_PROFILE, name: 'Anna' });
    });
    expect(result.current.userProfile?.name).toBe('Anna');
  });

  it('saveUserProfile writes to the repository', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper: makeWrapper(repos) });
    await act(async () => {
      await result.current.saveUserProfile({ ...DEFAULT_PROFILE, name: 'Lena' });
    });
    expect(result.current.userProfile?.name).toBe('Lena');
  });
});

describe('useNutritionPlan', () => {
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
  });

  it('starts with null active plan', async () => {
    const { result } = renderHook(() => useNutritionPlan(), { wrapper: makeWrapper(repos) });
    await act(async () => {});
    expect(result.current.activeNutritionPlan).toBeNull();
  });

  it('loads a pre-existing plan from repository on mount', async () => {
    const plan = {
      name: 'Diet', calories: 1500, proteins: 90, fats: 50, carbs: 160,
      isCustom: false, allowedProducts: [], forbiddenProducts: [],
    };
    await repos.nutritionPlan.set(plan);
    const { result } = renderHook(() => useNutritionPlan(), { wrapper: makeWrapper(repos) });
    await act(async () => {});
    expect(result.current.activeNutritionPlan).toEqual(plan);
  });

  it('setActivePlan updates state and persists to repository', async () => {
    const { result } = renderHook(() => useNutritionPlan(), { wrapper: makeWrapper(repos) });
    await act(async () => {});
    const plan = {
      name: 'Keto', calories: 1600, proteins: 120, fats: 100, carbs: 30,
      isCustom: true, allowedProducts: [], forbiddenProducts: [],
    };
    await act(async () => {
      await result.current.setActivePlan(plan);
    });
    expect(result.current.activeNutritionPlan).toEqual(plan);
    expect(await repos.nutritionPlan.get()).toEqual(plan);
  });

  it('setActivePlan(null) clears the plan', async () => {
    const plan = {
      name: 'Diet', calories: 1500, proteins: 90, fats: 50, carbs: 160,
      isCustom: false, allowedProducts: [], forbiddenProducts: [],
    };
    await repos.nutritionPlan.set(plan);
    const { result } = renderHook(() => useNutritionPlan(), { wrapper: makeWrapper(repos) });
    await act(async () => {});
    await act(async () => {
      await result.current.setActivePlan(null);
    });
    expect(result.current.activeNutritionPlan).toBeNull();
    expect(await repos.nutritionPlan.get()).toBeNull();
  });
});
