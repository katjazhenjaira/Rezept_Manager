// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DataProvider } from '../DataProvider';
import { useData } from '../DataContext';
import { RepositoryContext, type Repositories } from '../RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';

function makeRepos() {
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
        <DataProvider>{children}</DataProvider>
      </RepositoryContext.Provider>
    );
  };
}

describe('DataProvider', () => {
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
  });

  it('starts with empty arrays', () => {
    const { result } = renderHook(() => useData(), { wrapper: makeWrapper(repos) });
    expect(result.current.recipes).toEqual([]);
    expect(result.current.plannerEntries).toEqual([]);
    expect(result.current.cartItems).toEqual([]);
    expect(result.current.programs).toEqual([]);
  });

  it('reflects recipes added to the repository', async () => {
    const { result } = renderHook(() => useData(), { wrapper: makeWrapper(repos) });

    await act(async () => {
      await repos.recipes.add({
        title: 'Borsch',
        time: '60m',
        servings: 4,
        categories: [],
        ingredients: [],
        steps: [],
        macros: { calories: 300, proteins: 10, fats: 5, carbs: 40 },
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    expect(result.current.recipes).toHaveLength(1);
    expect(result.current.recipes[0]?.title).toBe('Borsch');
  });

  it('reflects cart items added to the repository', async () => {
    const { result } = renderHook(() => useData(), { wrapper: makeWrapper(repos) });

    await act(async () => {
      await repos.cart.add({
        name: 'Milk',
        amount: '1L',
        sourceDishes: [],
        checked: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0]?.name).toBe('Milk');
  });

  it('exposes no errors while subscriptions are healthy', () => {
    const { result } = renderHook(() => useData(), { wrapper: makeWrapper(repos) });
    expect(result.current.errors ?? []).toEqual([]);
  });

  it('reports a failed subscription so the UI can tell "error" from "no data"', () => {
    const { result } = renderHook(() => useData(), { wrapper: makeWrapper(repos) });

    act(() => {
      repos.recipes.failSubscriptions(new Error('permission-denied'));
    });

    expect(result.current.errors).toEqual(['recipes']);
    expect(result.current.recipes).toEqual([]);
  });

  it('collects errors from every failing collection', () => {
    const { result } = renderHook(() => useData(), { wrapper: makeWrapper(repos) });

    act(() => {
      repos.planner.failSubscriptions(new Error('permission-denied'));
      repos.cart.failSubscriptions(new Error('permission-denied'));
      repos.programs.failSubscriptions(new Error('permission-denied'));
    });

    expect(result.current.errors).toEqual(['plannerEntries', 'cartItems', 'programs']);
  });

  it('clears the error once the collection delivers data again', async () => {
    const { result } = renderHook(() => useData(), { wrapper: makeWrapper(repos) });

    act(() => {
      repos.recipes.failSubscriptions(new Error('permission-denied'));
    });
    expect(result.current.errors).toEqual(['recipes']);

    await act(async () => {
      await repos.recipes.add({
        title: 'Borsch',
        time: '60m',
        servings: 4,
        categories: [],
        ingredients: [],
        steps: [],
        macros: { calories: 300, proteins: 10, fats: 5, carbs: 40 },
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    expect(result.current.errors).toEqual([]);
  });

  it('unsubscribes from all repos on unmount', () => {
    const { unmount } = renderHook(() => useData(), { wrapper: makeWrapper(repos) });
    unmount();
    expect(repos.recipes.listenerCount).toBe(0);
    expect(repos.planner.listenerCount).toBe(0);
    expect(repos.cart.listenerCount).toBe(0);
    expect(repos.programs.listenerCount).toBe(0);
  });
});
