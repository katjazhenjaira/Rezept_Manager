// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecipeFilters } from '../useRecipeFilters';
import type { Recipe, Program } from '@/shared/domain/types';

function makeRecipe(overrides: Partial<Recipe> & Pick<Recipe, 'id' | 'title'>): Recipe {
  return {
    time: '10 мин',
    servings: 1,
    categories: [],
    ingredients: [],
    steps: [],
    macros: { calories: 100, proteins: 1, fats: 1, carbs: 1 },
    createdAt: '2026-01-01',
    ...overrides,
  };
}

function makeProgram(overrides: Partial<Program> & Pick<Program, 'id' | 'name'>): Program {
  return {
    description: '',
    creator: '',
    link: '',
    recipeIds: [],
    createdAt: '2026-01-01',
    ...overrides,
  };
}

describe('useRecipeFilters', () => {
  it('filters by search query case-insensitively on title', () => {
    const recipes = [
      makeRecipe({ id: 'r1', title: 'Овсяная каша' }),
      makeRecipe({ id: 'r2', title: 'Омлет' }),
    ];
    const { result } = renderHook(() => useRecipeFilters(recipes, []));

    act(() => result.current.setSearchQuery('ОВСЯ'));

    expect(result.current.filteredRecipes.map((r) => r.id)).toEqual(['r1']);
  });

  it('recipeView "favorites" keeps only isFavorite recipes', () => {
    const recipes = [
      makeRecipe({ id: 'r1', title: 'A', isFavorite: true }),
      makeRecipe({ id: 'r2', title: 'B', isFavorite: false }),
      makeRecipe({ id: 'r3', title: 'C' }),
    ];
    const { result } = renderHook(() => useRecipeFilters(recipes, []));

    act(() => result.current.setRecipeView('favorites'));

    expect(result.current.filteredRecipes.map((r) => r.id)).toEqual(['r1']);
  });

  it('categories use AND semantics: recipe must include every toggled category', () => {
    const recipes = [
      makeRecipe({ id: 'r1', title: 'A', categories: ['A', 'B'] }),
      makeRecipe({ id: 'r2', title: 'B', categories: ['A'] }),
      makeRecipe({ id: 'r3', title: 'C', categories: ['B'] }),
    ];
    const { result } = renderHook(() => useRecipeFilters(recipes, []));

    act(() => {
      result.current.toggleFilterCategory('A');
      result.current.toggleFilterCategory('B');
    });

    expect(result.current.filteredRecipes.every((r) => ['A', 'B'].every((c) => r.categories.includes(c)))).toBe(
      true,
    );
    expect(result.current.filteredRecipes.map((r) => r.id)).toEqual(['r1']);
  });

  it('filterAuthors matches recipe.author || "" — empty string in filter matches authorless recipes', () => {
    const recipes = [
      makeRecipe({ id: 'r1', title: 'A', author: 'Alice' }),
      makeRecipe({ id: 'r2', title: 'B', author: 'Bob' }),
      makeRecipe({ id: 'r3', title: 'C' }), // no author
    ];
    const { result } = renderHook(() => useRecipeFilters(recipes, []));

    act(() => result.current.setFilterAuthors(['Alice']));
    expect(result.current.filteredRecipes.map((r) => r.id)).toEqual(['r1']);

    // The hook falls back `recipe.author || ''` — selecting '' as a filter author
    // matches recipes with no author (documents actual behavior, not asserting desirability).
    act(() => result.current.setFilterAuthors(['']));
    expect(result.current.filteredRecipes.map((r) => r.id)).toEqual(['r3']);
  });

  it('filterPrograms includes recipes only present in a subfolder recipeIds', () => {
    const recipes = [
      makeRecipe({ id: 'r1', title: 'A' }),
      makeRecipe({ id: 'r2', title: 'B' }),
      makeRecipe({ id: 'r3', title: 'C' }),
    ];
    const programs = [
      makeProgram({
        id: 'p1',
        name: 'Program 1',
        recipeIds: ['r1'],
        subfolders: [
          { id: 'sf1', name: 'Sub', description: '', recipeIds: ['r2'] },
        ],
      }),
    ];
    const { result } = renderHook(() => useRecipeFilters(recipes, programs));

    act(() => result.current.setFilterPrograms(['Program 1']));

    expect(result.current.filteredRecipes.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
  });

  it('filterMaxTime: parseInt("45 мин") passes when max >= 45', () => {
    const recipes = [makeRecipe({ id: 'r1', title: 'A', time: '45 мин' })];
    const { result } = renderHook(() => useRecipeFilters(recipes, []));

    act(() => result.current.setFilterMaxTime(45));
    expect(result.current.filteredRecipes.map((r) => r.id)).toEqual(['r1']);

    act(() => result.current.setFilterMaxTime(44));
    expect(result.current.filteredRecipes).toEqual([]);
  });

  it('filterMaxTime: unparseable time (parseInt -> NaN -> || 0) always passes', () => {
    const recipes = [makeRecipe({ id: 'r1', title: 'A', time: 'быстро' })];
    const { result } = renderHook(() => useRecipeFilters(recipes, []));

    act(() => result.current.setFilterMaxTime(0));
    expect(result.current.filteredRecipes.map((r) => r.id)).toEqual(['r1']);
  });

  it('filterMaxCalories excludes recipes above the threshold', () => {
    const recipes = [
      makeRecipe({ id: 'r1', title: 'A', macros: { calories: 300, proteins: 1, fats: 1, carbs: 1 } }),
      makeRecipe({ id: 'r2', title: 'B', macros: { calories: 900, proteins: 1, fats: 1, carbs: 1 } }),
    ];
    const { result } = renderHook(() => useRecipeFilters(recipes, []));

    act(() => result.current.setFilterMaxCalories(500));

    expect(result.current.filteredRecipes.map((r) => r.id)).toEqual(['r1']);
  });

  describe('sorting', () => {
    const recipes = [
      makeRecipe({
        id: 'r1',
        title: 'A',
        createdAt: '2026-01-01',
        time: '30 мин',
        macros: { calories: 300, proteins: 1, fats: 1, carbs: 1 },
      }),
      makeRecipe({
        id: 'r2',
        title: 'B',
        createdAt: '2026-03-01',
        time: '10 мин',
        macros: { calories: 100, proteins: 1, fats: 1, carbs: 1 },
      }),
      makeRecipe({
        id: 'r3',
        title: 'C',
        createdAt: '2026-02-01',
        time: '20 мин',
        macros: { calories: 200, proteins: 1, fats: 1, carbs: 1 },
      }),
    ];

    it('newest sorts by createdAt descending', () => {
      const { result } = renderHook(() => useRecipeFilters(recipes, []));
      act(() => result.current.setFilterSortBy('newest'));
      expect(result.current.filteredRecipes.map((r) => r.id)).toEqual(['r2', 'r3', 'r1']);
    });

    it('oldest sorts by createdAt ascending', () => {
      const { result } = renderHook(() => useRecipeFilters(recipes, []));
      act(() => result.current.setFilterSortBy('oldest'));
      expect(result.current.filteredRecipes.map((r) => r.id)).toEqual(['r1', 'r3', 'r2']);
    });

    it('time sorts by parseInt(time) ascending', () => {
      const { result } = renderHook(() => useRecipeFilters(recipes, []));
      act(() => result.current.setFilterSortBy('time'));
      expect(result.current.filteredRecipes.map((r) => r.id)).toEqual(['r2', 'r3', 'r1']);
    });

    it('calories sorts ascending', () => {
      const { result } = renderHook(() => useRecipeFilters(recipes, []));
      act(() => result.current.setFilterSortBy('calories'));
      expect(result.current.filteredRecipes.map((r) => r.id)).toEqual(['r2', 'r3', 'r1']);
    });
  });

  it('allAuthors is deduped, sorted, and excludes empty authors', () => {
    const recipes = [
      makeRecipe({ id: 'r1', title: 'A', author: 'Bob' }),
      makeRecipe({ id: 'r2', title: 'B', author: 'Alice' }),
      makeRecipe({ id: 'r3', title: 'C', author: 'Bob' }),
      makeRecipe({ id: 'r4', title: 'D' }), // no author
    ];
    const { result } = renderHook(() => useRecipeFilters(recipes, []));

    expect(result.current.allAuthors).toEqual(['Alice', 'Bob']);
  });

  it('allPrograms is sorted by name', () => {
    const programs = [
      makeProgram({ id: 'p1', name: 'Zebra' }),
      makeProgram({ id: 'p2', name: 'Alpha' }),
    ];
    const { result } = renderHook(() => useRecipeFilters([], programs));

    expect(result.current.allPrograms).toEqual(['Alpha', 'Zebra']);
  });

  it('toggleFilterCategory adds then removes idempotently (round-trip)', () => {
    const { result } = renderHook(() => useRecipeFilters([], []));

    act(() => result.current.toggleFilterCategory('X'));
    expect(result.current.filterCategories).toEqual(['X']);

    act(() => result.current.toggleFilterCategory('X'));
    expect(result.current.filterCategories).toEqual([]);
  });

  it('resetFilters restores defaults', () => {
    const { result } = renderHook(() => useRecipeFilters([], []));

    act(() => {
      result.current.toggleFilterCategory('X');
      result.current.setFilterAuthors(['Alice']);
      result.current.setFilterPrograms(['Prog']);
      result.current.setFilterMaxTime(10);
      result.current.setFilterMaxCalories(50);
    });

    act(() => result.current.resetFilters());

    expect(result.current.filterCategories).toEqual([]);
    expect(result.current.filterAuthors).toEqual([]);
    expect(result.current.filterPrograms).toEqual([]);
    expect(result.current.filterMaxTime).toBe(120);
    expect(result.current.filterMaxCalories).toBe(1000);
  });

  describe('hasActiveFilters', () => {
    it('is false initially', () => {
      const { result } = renderHook(() => useRecipeFilters([], []));
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('is true after setting a single non-default filter', () => {
      const { result } = renderHook(() => useRecipeFilters([], []));
      act(() => result.current.setFilterMaxTime(60));
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('is false again after resetFilters', () => {
      const { result } = renderHook(() => useRecipeFilters([], []));
      act(() => result.current.setFilterMaxTime(60));
      act(() => result.current.resetFilters());
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });
});
