// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DataContext } from '@/app/providers/DataContext';
import { RepositoryContext } from '@/app/providers/RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';
import type { UserProfile, ActiveNutritionPlan } from '@/shared/domain/types';

const mockProfile: UserProfile = {
  name: 'Тест',
  age: 30,
  gender: 'female',
  currentWeight: 60,
  targetWeight: 55,
  targetCalories: 1800,
  targetProteins: 100,
  targetFats: 60,
  targetCarbs: 200,
  waterGoal: 2000,
  allergies: [],
};

const emptyData = { recipes: [], plannerEntries: [], cartItems: [], programs: [] };

const fakeRepos = {
  recipes: new FakeRecipesRepository(),
  planner: new FakePlannerRepository(),
  cart: new FakeCartRepository(),
  programs: new FakeProgramsRepository(),
  userProfile: new FakeUserProfileRepository(),
  nutritionPlan: new FakeNutritionPlanRepository(),
};

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <RepositoryContext.Provider value={fakeRepos}>
      <DataContext.Provider value={emptyData}>
        {children}
      </DataContext.Provider>
    </RepositoryContext.Provider>
  );
}

describe('PlannerView', () => {
  it('renders without crashing', async () => {
    let PlannerViewModule: { PlannerView: React.ComponentType<any> } | null = null;
    try {
      PlannerViewModule = await import('../PlannerView');
    } catch {
      // File doesn't exist yet — test fails as expected
      expect(true).toBe(false);
      return;
    }

    const { PlannerView } = PlannerViewModule;

    render(
      <Wrapper>
        <PlannerView
          recipes={[]}
          userProfile={mockProfile}
          activeNutritionPlan={null as ActiveNutritionPlan | null}
          checkedEntries={[]}
          onCheckedEntriesChange={vi.fn()}
          onSelectRecipe={vi.fn()}
          onNavigateToCart={vi.fn()}
          mealTypes={['Завтрак', 'Обед', 'Ужин', 'Перекус']}
          onMealTypesChange={vi.fn()}
        />
      </Wrapper>
    );
    expect(screen.getByText(/составь твой/i)).toBeDefined();
  });
});
