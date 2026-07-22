// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { format } from 'date-fns';
import type { ReactNode } from 'react';
import { DataContext } from '@/app/providers/DataContext';
import { RepositoryContext } from '@/app/providers/RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';
import type { UserProfile, ActiveNutritionPlan, PlannerEntry } from '@/shared/domain/types';
import { PlannerView, type PlannerViewProps } from '../PlannerView';

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
      <DataContext.Provider value={emptyData}>{children}</DataContext.Provider>
    </RepositoryContext.Provider>
  );
}

describe('PlannerView', () => {
  it('renders without crashing', async () => {
    let PlannerViewModule: { PlannerView: React.ComponentType<PlannerViewProps> };
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
      </Wrapper>,
    );
    expect(screen.getByText(/составь твой/i)).toBeDefined();
  });

  it('counts product entries towards month view calorie total', async () => {
    const { PlannerView } = await import('../PlannerView');

    const productEntry: PlannerEntry = {
      id: '1',
      date: format(new Date(), 'yyyy-MM-dd'),
      mealType: 'Завтрак',
      type: 'product',
      productName: 'Яблоко',
      macros: { calories: 250, proteins: 1, fats: 0, carbs: 60 },
    };

    render(
      <RepositoryContext.Provider value={fakeRepos}>
        <DataContext.Provider value={{ ...emptyData, plannerEntries: [productEntry] }}>
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
        </DataContext.Provider>
      </RepositoryContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Месяц' }));

    expect(screen.getByText('250')).toBeDefined();
  });

  describe('лимиты КБЖУ при активной программе (CRIT-2)', () => {
    const overLimitEntry: PlannerEntry = {
      id: 'over-1',
      date: format(new Date(), 'yyyy-MM-dd'),
      mealType: 'Завтрак',
      type: 'product',
      productName: 'Торт',
      macros: { calories: 1500, proteins: 50, fats: 30, carbs: 100 },
    };

    const activePlan: ActiveNutritionPlan = {
      name: 'Сушка',
      calories: 1400,
      proteins: 90,
      fats: 50,
      carbs: 150,
      isCustom: false,
    };

    function renderPlanner(plan: ActiveNutritionPlan | null, entries: PlannerEntry[]) {
      return render(
        <RepositoryContext.Provider value={fakeRepos}>
          <DataContext.Provider value={{ ...emptyData, plannerEntries: entries }}>
            <PlannerView
              recipes={[]}
              userProfile={mockProfile}
              activeNutritionPlan={plan}
              checkedEntries={[]}
              onCheckedEntriesChange={vi.fn()}
              onSelectRecipe={vi.fn()}
              onNavigateToCart={vi.fn()}
              mealTypes={['Завтрак', 'Обед', 'Ужин', 'Перекус']}
              onMealTypesChange={vi.fn()}
            />
          </DataContext.Provider>
        </RepositoryContext.Provider>,
      );
    }

    it('считает превышение от целей активной программы, а не от профиля', () => {
      // 1500 ккал: в пределах цели профиля (1800), но выше цели программы (1400).
      // Трекер (resolveActiveTargets) для тех же данных показал бы превышение — Планер обязан совпасть.
      renderPlanner(activePlan, [overLimitEntry]);

      expect(screen.getByText(/Вы превышаете норму/i)).toBeDefined();
    });

    it('без активной программы использует цели профиля', () => {
      renderPlanner(null, [overLimitEntry]);

      expect(screen.queryByText(/Вы превышаете норму/i)).toBeNull();
    });
  });
});
