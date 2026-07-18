// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DataContext } from '@/app/providers/DataContext';
import { UserProfileContext } from '@/app/providers/UserProfileContext';
import type { UserProfile, ActiveNutritionPlan, PlannerEntry, Recipe } from '@/shared/domain/types';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'test-id' }),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn(),
}));

vi.mock('@/infrastructure/firebaseApp', () => ({ db: {} }));

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

const emptyData = { recipes: [], plannerEntries: [], cartItems: [], programs: [] };
const dataWithEntry = { recipes: [mockRecipe], plannerEntries: [mockEntry], cartItems: [], programs: [] };

function makeWrapper(data: typeof emptyData) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <UserProfileContext.Provider
        value={{
          userProfile: mockProfile,
          saveUserProfile: mockSaveUserProfile,
          activeNutritionPlan: mockNutritionPlan,
          setActivePlan: mockSetActivePlan,
        }}
      >
        <DataContext.Provider value={data}>
          {children}
        </DataContext.Provider>
      </UserProfileContext.Provider>
    );
  };
}

describe('TrackerView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', async () => {
    let mod: { TrackerView: React.ComponentType<any> } | null = null;
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
    let mod: { TrackerView: React.ComponentType<any> } | null = null;
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
    let mod: { TrackerView: React.ComponentType<any> } | null = null;
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
