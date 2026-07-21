// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DataContext } from '@/app/providers/DataContext';
import { UserProfileContext } from '@/app/providers/UserProfileContext';
import { RepositoryContext } from '@/app/providers/RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';
import type { UserProfile, ActiveNutritionPlan, PlannerEntry, Recipe } from '@/shared/domain/types';
import type { DataState } from '@/app/providers/DataContext';
import type { TrackerViewProps } from '../TrackerView';

vi.mock('@/services/ai/aiClient', () => ({
  aiClient: {
    fillRemaining: vi.fn().mockResolvedValue({
      options: [
        {
          id: 'opt-1',
          type: 'product',
          description: 'Творог 5%',
          macros: { calories: 120, proteins: 18, fats: 5, carbs: 3 },
        },
      ],
      reason: 'Хороший источник белка',
    }),
  },
}));

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

const mockNutritionPlan: ActiveNutritionPlan | null = null;
const mockSetActivePlan = vi.fn().mockResolvedValue(undefined);
const mockSaveUserProfile = vi.fn().mockResolvedValue(undefined);

const today = new Date().toISOString().slice(0, 10);

const mockRecipe: Recipe = {
  id: 'r1',
  title: 'Куриная грудка',
  macros: { calories: 200, proteins: 30, fats: 5, carbs: 0 },
  ingredients: [],
  steps: [],
  categories: [],
  time: '20 мин',
  servings: 1,
  createdAt: new Date().toISOString(),
};

const mockEntry: PlannerEntry = {
  id: 'e1',
  date: today,
  mealType: 'Обед',
  type: 'recipe',
  recipeId: 'r1',
};

const emptyData: DataState = { recipes: [], plannerEntries: [], cartItems: [], programs: [] };
const dataWithEntry: DataState = {
  recipes: [mockRecipe],
  plannerEntries: [mockEntry],
  cartItems: [],
  programs: [],
};

const fakeRepos = {
  recipes: new FakeRecipesRepository(),
  planner: new FakePlannerRepository(),
  cart: new FakeCartRepository(),
  programs: new FakeProgramsRepository(),
  userProfile: new FakeUserProfileRepository(),
  nutritionPlan: new FakeNutritionPlanRepository(),
};

function makeWrapper(data: typeof emptyData) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RepositoryContext.Provider value={fakeRepos}>
        <UserProfileContext.Provider
          value={{
            userProfile: mockProfile,
            saveUserProfile: mockSaveUserProfile,
            activeNutritionPlan: mockNutritionPlan,
            setActivePlan: mockSetActivePlan,
          }}
        >
          <DataContext.Provider value={data}>{children}</DataContext.Provider>
        </UserProfileContext.Provider>
      </RepositoryContext.Provider>
    );
  };
}

describe('TrackerView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', async () => {
    let mod: { TrackerView: React.ComponentType<TrackerViewProps> };
    try {
      mod = await import('../TrackerView');
    } catch {
      expect(true).toBe(false);
      return;
    }

    const { TrackerView } = mod;
    const Wrapper = makeWrapper(emptyData);

    render(
      <Wrapper>
        <TrackerView
          checkedEntries={[]}
          onCheckedEntriesChange={vi.fn()}
          mealTypes={['Завтрак', 'Обед', 'Ужин', 'Перекус']}
          onSelectRecipe={vi.fn()}
          onNavigateToPlanner={vi.fn()}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/трекер твоего питания сегодня/i)).toBeDefined();
  });

  it('shows meal from plannerEntries for today when entry is checked', async () => {
    let mod: { TrackerView: React.ComponentType<TrackerViewProps> };
    try {
      mod = await import('../TrackerView');
    } catch {
      expect(true).toBe(false);
      return;
    }

    const { TrackerView } = mod;
    const Wrapper = makeWrapper(dataWithEntry);

    render(
      <Wrapper>
        <TrackerView
          checkedEntries={['e1']}
          onCheckedEntriesChange={vi.fn()}
          mealTypes={['Завтрак', 'Обед', 'Ужин', 'Перекус']}
          onSelectRecipe={vi.fn()}
          onNavigateToPlanner={vi.fn()}
        />
      </Wrapper>,
    );

    expect(screen.getByText('Куриная грудка')).toBeDefined();
  });

  it('calls onNavigateToPlanner when empty state link is clicked', async () => {
    let mod: { TrackerView: React.ComponentType<TrackerViewProps> };
    try {
      mod = await import('../TrackerView');
    } catch {
      expect(true).toBe(false);
      return;
    }

    const { TrackerView } = mod;
    const Wrapper = makeWrapper(emptyData);
    const onNavigateToPlanner = vi.fn();

    render(
      <Wrapper>
        <TrackerView
          checkedEntries={[]}
          onCheckedEntriesChange={vi.fn()}
          mealTypes={['Завтрак', 'Обед', 'Ужин', 'Перекус']}
          onSelectRecipe={vi.fn()}
          onNavigateToPlanner={onNavigateToPlanner}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByText(/перейти в планер/i));
    expect(onNavigateToPlanner).toHaveBeenCalledOnce();
  });
});
