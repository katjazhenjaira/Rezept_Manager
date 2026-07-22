// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
import { TrackerView, type TrackerViewProps } from '../TrackerView';
import { aiClient } from '@/services/ai/aiClient';
import type { FillRemainingResponse } from '@/services/ai/contracts';
import { DEFAULT_PROFILE } from '@/shared/domain/defaults';
import { sumMacros } from '@/shared/domain/macros';

const defaultSuggestion: FillRemainingResponse = {
  options: [
    {
      id: 'opt-1',
      type: 'product',
      description: 'Творог 5%',
      macros: { calories: 120, proteins: 18, fats: 5, carbs: 3 },
    },
    {
      id: 'opt-2',
      type: 'product',
      description: 'Яблоко',
      macros: { calories: 80, proteins: 0, fats: 0, carbs: 20 },
    },
    {
      id: 'opt-3',
      type: 'product',
      description: 'Куриное филе 100 г',
      macros: { calories: 165, proteins: 31, fats: 4, carbs: 0 },
    },
  ],
  reason: 'Хороший источник белка',
};

vi.mock('@/services/ai/aiClient', () => ({
  aiClient: {
    fillRemaining: vi.fn(),
  },
}));

// PERF-1: sumMacros оборачивается шпионом (реализация настоящая), чтобы проверить,
// что агрегация КБЖУ не пересчитывается на рендерах, не связанных с данными.
vi.mock('@/shared/domain/macros', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/domain/macros')>();
  return { ...actual, sumMacros: vi.fn(actual.sumMacros) };
});

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

function makeWrapper(data: typeof emptyData, profile: UserProfile | null = mockProfile) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RepositoryContext.Provider value={fakeRepos}>
        <UserProfileContext.Provider
          value={{
            userProfile: profile,
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

const profileWithAllergy: UserProfile = { ...mockProfile, allergies: ['молоко'] };

const milkRecipe: Recipe = {
  id: 'r-milk',
  title: 'Молочная каша',
  macros: { calories: 300, proteins: 10, fats: 8, carbs: 45 },
  ingredients: ['Овсяные хлопья 60 г', 'Молоко 200 мл'],
  steps: [],
  categories: [],
  time: '10 мин',
  servings: 1,
  createdAt: new Date().toISOString(),
};

const dataWithMilkRecipe: DataState = {
  recipes: [milkRecipe],
  plannerEntries: [],
  cartItems: [],
  programs: [],
};

/** Прогоняет сценарий «получить AI-подсказку → выбрать её → добавить в рацион». */
async function suggestAndAdd(optionLabel: string) {
  fireEvent.click(screen.getByText(/заполнить остаток кбжу/i));
  const option = await screen.findByText(optionLabel);
  fireEvent.click(option);
  fireEvent.click(screen.getByText(/добавить в рацион/i));
}

describe('TrackerView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeRepos.planner.reset();
    vi.mocked(aiClient.fillRemaining).mockResolvedValue(defaultSuggestion);
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  // PERF-1: агрегаты по записям дня не должны пересчитываться на рендерах,
  // вызванных состоянием UI (isSuggesting, выбор вариантов, открытие модалки).
  it('не пересчитывает КБЖУ дня при рендерах, не меняющих данные', async () => {
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

    const callsAfterMount = vi.mocked(sumMacros).mock.calls.length;

    fireEvent.click(screen.getByText(/заполнить остаток кбжу/i));
    await screen.findByText('Творог 5%');
    fireEvent.click(screen.getByText('Творог 5%'));

    expect(vi.mocked(sumMacros).mock.calls.length).toBe(callsAfterMount);
  });

  // LOG-7: пока профиль не загружен, цель по воде должна браться из DEFAULT_PROFILE,
  // а не рендериться пустой строкой.
  it('показывает цель по воде из DEFAULT_PROFILE, пока профиль не загружен', () => {
    const Wrapper = makeWrapper(emptyData, null);

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

    expect(screen.getByText(`Твоя цель: ${DEFAULT_PROFILE.waterGoal} мл`)).toBeDefined();
    expect(
      screen.getByText(`${Math.round(DEFAULT_PROFILE.currentWeight * 35)} мл/день`),
    ).toBeDefined();
  });

  it('показывает цель по воде из профиля пользователя, когда он загружен', () => {
    const Wrapper = makeWrapper(emptyData, { ...mockProfile, waterGoal: 2500, currentWeight: 70 });

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

    expect(screen.getByText('Твоя цель: 2500 мл')).toBeDefined();
    expect(screen.getByText('2450 мл/день')).toBeDefined();
  });

  // CONV-2: домен возвращает name === null («активного плана нет»), подпись резолвит UI.
  it('подписывает текущий план по умолчанию, когда активного плана нет', () => {
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

    expect(screen.getByText('По умолчанию (из настроек)')).toBeDefined();
  });

  it('передаёт в AI-запрос читаемое имя плана, а не пустое значение', async () => {
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

    fireEvent.click(screen.getByText(/заполнить остаток кбжу/i));

    await waitFor(() => expect(aiClient.fillRemaining).toHaveBeenCalled());
    expect(vi.mocked(aiClient.fillRemaining).mock.calls[0]?.[0].planName).toBe(
      'По умолчанию (из настроек)',
    );
  });

  // CRIT-1: safety-critical constraint №1 — allergy check обязателен перед добавлением
  // AI-подсказки в планер (Tracker / AI-suggestions).
  describe('allergy-гейт для AI-подсказок', () => {
    function renderWithSuggestion(data: DataState = emptyData) {
      const Wrapper = makeWrapper(data, profileWithAllergy);
      return render(
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
    }

    it('не добавляет продукт с аллергеном, если пользователь отменил confirm', async () => {
      vi.mocked(aiClient.fillRemaining).mockResolvedValue({
        ...defaultSuggestion,
        options: [
          {
            id: 'opt-milk',
            type: 'product',
            description: 'Молоко 3.2%, 200 мл',
            macros: { calories: 120, proteins: 6, fats: 6, carbs: 9 },
          },
          defaultSuggestion.options[1],
          defaultSuggestion.options[2],
        ],
      });
      vi.mocked(confirm).mockReturnValue(false);
      const addSpy = vi.spyOn(fakeRepos.planner, 'add');

      renderWithSuggestion();
      await suggestAndAdd('Молоко 3.2%, 200 мл');

      await waitFor(() => expect(confirm).toHaveBeenCalled());
      expect(vi.mocked(confirm).mock.calls[0]?.[0]).toContain('молоко');
      expect(addSpy).not.toHaveBeenCalled();
    });

    it('не добавляет рецепт с аллергеном в ингредиентах, если пользователь отменил confirm', async () => {
      vi.mocked(aiClient.fillRemaining).mockResolvedValue({
        ...defaultSuggestion,
        options: [
          {
            id: 'opt-recipe',
            type: 'recipe',
            recipeId: 'r-milk',
            description: 'Молочная каша',
            macros: milkRecipe.macros,
          },
          defaultSuggestion.options[1],
          defaultSuggestion.options[2],
        ],
      });
      vi.mocked(confirm).mockReturnValue(false);
      const addSpy = vi.spyOn(fakeRepos.planner, 'add');

      renderWithSuggestion(dataWithMilkRecipe);
      await suggestAndAdd('Молочная каша');

      await waitFor(() => expect(confirm).toHaveBeenCalled());
      expect(vi.mocked(confirm).mock.calls[0]?.[0]).toContain('молоко');
      expect(addSpy).not.toHaveBeenCalled();
    });

    it('добавляет вариант с аллергеном, если пользователь подтвердил confirm', async () => {
      vi.mocked(aiClient.fillRemaining).mockResolvedValue({
        ...defaultSuggestion,
        options: [
          {
            id: 'opt-milk',
            type: 'product',
            description: 'Молоко 3.2%, 200 мл',
            macros: { calories: 120, proteins: 6, fats: 6, carbs: 9 },
          },
          defaultSuggestion.options[1],
          defaultSuggestion.options[2],
        ],
      });
      vi.mocked(confirm).mockReturnValue(true);
      const addSpy = vi.spyOn(fakeRepos.planner, 'add');

      renderWithSuggestion();
      await suggestAndAdd('Молоко 3.2%, 200 мл');

      await waitFor(() => expect(addSpy).toHaveBeenCalledOnce());
      expect(confirm).toHaveBeenCalled();
    });

    it('не спрашивает подтверждение для варианта без аллергенов', async () => {
      const addSpy = vi.spyOn(fakeRepos.planner, 'add');

      renderWithSuggestion();
      await suggestAndAdd('Яблоко');

      await waitFor(() => expect(addSpy).toHaveBeenCalledOnce());
      expect(confirm).not.toHaveBeenCalled();
    });
  });
});
