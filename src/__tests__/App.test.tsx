// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserProfileContext } from '@/app/providers/UserProfileContext';
import { DataContext } from '@/app/providers/DataContext';
import { RepositoryContext, type Repositories } from '@/app/providers/RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';
import { DEFAULT_PROFILE, DEFAULT_MEAL_TYPES } from '@/shared/domain/defaults';
import type { UserProfile } from '@/shared/domain/types';
import App from '../App';

// Тяжёлые вкладки замокированы: тесты проверяют логику самого App (deep-link на программу,
// чтение категорий из localStorage), а не рендер вкладок — у них свои тест-файлы.
vi.mock('@/features/recipes/RecipesView', () => ({
  RecipesView: ({ availableCategories }: { availableCategories: string[] }) => (
    <div data-testid="categories">{JSON.stringify(availableCategories)}</div>
  ),
}));
vi.mock('@/features/planner/PlannerView', () => ({
  PlannerView: ({
    mealTypes,
    onMealTypesChange,
  }: {
    mealTypes: string[];
    onMealTypesChange: (types: string[]) => void;
  }) => (
    <div>
      <div data-testid="meal-types">{JSON.stringify(mealTypes)}</div>
      <button onClick={() => onMealTypesChange([...mealTypes, 'Полдник'])}>add-meal-type</button>
    </div>
  ),
}));
vi.mock('@/features/tracker/TrackerView', () => ({ TrackerView: () => <div /> }));
vi.mock('@/features/programs/ProgramsView', () => ({ ProgramsView: () => <div /> }));
vi.mock('@/features/cart/CartView', () => ({ CartView: () => <div /> }));
vi.mock('@/features/settings/SettingsModal', () => ({ SettingsModal: () => <div /> }));
vi.mock('@/app/layout/TabBar', () => ({
  TabBar: ({ onTabChange }: { onTabChange: (tab: string) => void }) => (
    <button onClick={() => onTabChange('planner')}>go-planner</button>
  ),
}));
vi.mock('@/app/layout/AppHeader', () => ({ AppHeader: () => <div /> }));
vi.mock('@/app/layout/RecipeSelectionBar', () => ({ RecipeSelectionBar: () => <div /> }));

function makeRepos(): Repositories {
  return {
    recipes: new FakeRecipesRepository(),
    planner: new FakePlannerRepository(),
    cart: new FakeCartRepository(),
    programs: new FakeProgramsRepository(),
    userProfile: new FakeUserProfileRepository(),
    nutritionPlan: new FakeNutritionPlanRepository(),
  };
}

function renderApp(
  repos: Repositories,
  profile: UserProfile | null = null,
  saveUserProfile: (p: UserProfile) => Promise<void> = vi.fn(),
) {
  return render(
    <RepositoryContext.Provider value={repos}>
      <UserProfileContext.Provider
        value={{
          userProfile: profile,
          saveUserProfile,
          activeNutritionPlan: null,
          setActivePlan: vi.fn(),
        }}
      >
        <DataContext.Provider
          value={{ recipes: [], plannerEntries: [], cartItems: [], programs: [] }}
        >
          <App />
        </DataContext.Provider>
      </UserProfileContext.Provider>
    </RepositoryContext.Provider>,
  );
}

describe('App', () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = makeRepos();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('deep-link на программу (LOG-3)', () => {
    it('сообщает пользователю об ошибке, если загрузка программы отклонена', async () => {
      window.history.replaceState({}, '', '/?programId=p1');
      repos.programs.getById = vi.fn().mockRejectedValue(new Error('permission-denied'));

      renderApp(repos);

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalled();
      });
    });

    it('не показывает ошибку, когда deep-link отсутствует', async () => {
      renderApp(repos);

      await waitFor(() => {
        expect(screen.getByTestId('categories')).toBeDefined();
      });
      expect(window.alert).not.toHaveBeenCalled();
    });
  });

  describe('availableCategories из localStorage (TS-4)', () => {
    function readCategories(): unknown {
      return JSON.parse(screen.getByTestId('categories').textContent ?? 'null');
    }

    it('использует сохранённый список строк', () => {
      localStorage.setItem('availableCategories', JSON.stringify(['Завтрак', 'Полдник']));

      renderApp(repos);

      expect(readCategories()).toEqual(['Завтрак', 'Полдник']);
    });

    it('падает на дефолт, если в localStorage не массив', () => {
      localStorage.setItem('availableCategories', '{"a":1}');

      renderApp(repos);

      const categories = readCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories).toContain('Завтрак');
    });

    it('падает на дефолт, если массив содержит не-строки', () => {
      localStorage.setItem('availableCategories', '["Завтрак", 42, null]');

      renderApp(repos);

      const categories = readCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories).not.toContain(42);
      expect(categories).toContain('Обед');
    });

    it('падает на дефолт, если в localStorage невалидный JSON', () => {
      localStorage.setItem('availableCategories', '{not json');

      renderApp(repos);

      const categories = readCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories).toContain('Завтрак');
    });
  });

  describe('mealTypes из профиля пользователя (LOG-4)', () => {
    function readMealTypes(): unknown {
      return JSON.parse(screen.getByTestId('meal-types').textContent ?? 'null');
    }

    // AnimatePresence mode="wait" доигрывает exit-анимацию, поэтому вкладка появляется не сразу.
    async function openPlanner() {
      fireEvent.click(screen.getByText('go-planner'));
      await screen.findByTestId('meal-types');
    }

    it('берёт типы трапез из профиля', async () => {
      renderApp(repos, { ...DEFAULT_PROFILE, mealTypes: ['Завтрак', 'Ланч', 'Ужин'] });

      await openPlanner();

      expect(readMealTypes()).toEqual(['Завтрак', 'Ланч', 'Ужин']);
    });

    it('падает на дефолтный набор, если в профиле типов нет', async () => {
      const { mealTypes: _omitted, ...profileWithoutMealTypes } = DEFAULT_PROFILE;
      renderApp(repos, profileWithoutMealTypes);

      await openPlanner();

      expect(readMealTypes()).toEqual(DEFAULT_MEAL_TYPES);
    });

    it('сохраняет добавленный тип трапезы в профиль', async () => {
      const saveUserProfile = vi.fn().mockResolvedValue(undefined);
      const profile = { ...DEFAULT_PROFILE, mealTypes: ['Завтрак', 'Обед'] };
      renderApp(repos, profile, saveUserProfile);

      await openPlanner();
      fireEvent.click(screen.getByText('add-meal-type'));

      expect(saveUserProfile).toHaveBeenCalledWith({
        ...profile,
        mealTypes: ['Завтрак', 'Обед', 'Полдник'],
      });
    });

    it('сохраняет типы трапез поверх дефолтного профиля, когда профиля ещё нет', async () => {
      const saveUserProfile = vi.fn().mockResolvedValue(undefined);
      renderApp(repos, null, saveUserProfile);

      await openPlanner();
      fireEvent.click(screen.getByText('add-meal-type'));

      expect(saveUserProfile).toHaveBeenCalledWith({
        ...DEFAULT_PROFILE,
        mealTypes: [...DEFAULT_MEAL_TYPES, 'Полдник'],
      });
    });

    it('сообщает об ошибке, если сохранение профиля отклонено', async () => {
      const saveUserProfile = vi.fn().mockRejectedValue(new Error('permission-denied'));
      renderApp(repos, DEFAULT_PROFILE, saveUserProfile);

      await openPlanner();
      fireEvent.click(screen.getByText('add-meal-type'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalled();
      });
    });
  });
});
