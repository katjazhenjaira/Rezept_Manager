// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UserProfileContext } from '@/app/providers/UserProfileContext';
import { DataContext } from '@/app/providers/DataContext';
import { RepositoryContext, type Repositories } from '@/app/providers/RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';
import App from '../App';

// Тяжёлые вкладки замокированы: тесты проверяют логику самого App (deep-link на программу,
// чтение категорий из localStorage), а не рендер вкладок — у них свои тест-файлы.
vi.mock('@/features/recipes/RecipesView', () => ({
  RecipesView: ({ availableCategories }: { availableCategories: string[] }) => (
    <div data-testid="categories">{JSON.stringify(availableCategories)}</div>
  ),
}));
vi.mock('@/features/planner/PlannerView', () => ({ PlannerView: () => <div /> }));
vi.mock('@/features/tracker/TrackerView', () => ({ TrackerView: () => <div /> }));
vi.mock('@/features/programs/ProgramsView', () => ({ ProgramsView: () => <div /> }));
vi.mock('@/features/cart/CartView', () => ({ CartView: () => <div /> }));
vi.mock('@/features/settings/SettingsModal', () => ({ SettingsModal: () => <div /> }));
vi.mock('@/app/layout/TabBar', () => ({ TabBar: () => <div /> }));
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

function renderApp(repos: Repositories) {
  return render(
    <RepositoryContext.Provider value={repos}>
      <UserProfileContext.Provider
        value={{
          userProfile: null,
          saveUserProfile: vi.fn(),
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
});
