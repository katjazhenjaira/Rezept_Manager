import { useState } from 'react';
import type { Recipe, Program, RecipeView } from '@/shared/domain/types';

export function useRecipeFilters(recipes: Recipe[], programs: Program[]) {
  const [recipeView, setRecipeView] = useState<RecipeView>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSortBy, setFilterSortBy] = useState<'newest' | 'oldest' | 'time' | 'calories'>(
    'newest',
  );
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterAuthors, setFilterAuthors] = useState<string[]>([]);
  const [filterPrograms, setFilterPrograms] = useState<string[]>([]);
  const [filterMaxTime, setFilterMaxTime] = useState<number>(120);
  const [filterMaxCalories, setFilterMaxCalories] = useState<number>(1000);

  const toggleFilterCategory = (cat: string) => {
    setFilterCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const resetFilters = () => {
    setFilterCategories([]);
    setFilterAuthors([]);
    setFilterPrograms([]);
    setFilterMaxTime(120);
    setFilterMaxCalories(1000);
  };

  const allAuthors = Array.from(new Set(recipes.map((r) => r.author || '').filter(Boolean))).sort();
  const allPrograms = programs.map((p) => p.name).sort();

  const filteredRecipes = recipes
    .filter((recipe) => {
      const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesView = recipeView === 'all' || (recipeView === 'favorites' && recipe.isFavorite);
      const matchesCategory =
        filterCategories.length === 0 ||
        filterCategories.every((cat) => recipe.categories.includes(cat));
      const matchesAuthor =
        filterAuthors.length === 0 || filterAuthors.includes(recipe.author || '');

      const matchesProgram =
        filterPrograms.length === 0 ||
        filterPrograms.some((progName) => {
          const program = programs.find((p) => p.name === progName);
          if (!program) return false;
          const allRecipeIdsInProgram = [
            ...program.recipeIds,
            ...(program.subfolders?.flatMap((sf) => sf.recipeIds) || []),
          ];
          return allRecipeIdsInProgram.includes(recipe.id);
        });

      const timeValue = parseInt(recipe.time) || 0;
      const matchesTime = timeValue <= filterMaxTime;
      const matchesCalories = recipe.macros.calories <= filterMaxCalories;

      return (
        matchesSearch &&
        matchesView &&
        matchesCategory &&
        matchesAuthor &&
        matchesProgram &&
        matchesTime &&
        matchesCalories
      );
    })
    .sort((a, b) => {
      if (filterSortBy === 'newest')
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      if (filterSortBy === 'oldest')
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      if (filterSortBy === 'time') return (parseInt(a.time) || 0) - (parseInt(b.time) || 0);
      if (filterSortBy === 'calories') return a.macros.calories - b.macros.calories;
      return 0;
    });

  const hasActiveFilters =
    filterCategories.length > 0 ||
    filterAuthors.length > 0 ||
    filterPrograms.length > 0 ||
    filterMaxTime < 120 ||
    filterMaxCalories < 1000;

  return {
    recipeView,
    setRecipeView,
    searchQuery,
    setSearchQuery,
    filterSortBy,
    setFilterSortBy,
    filterCategories,
    toggleFilterCategory,
    filterAuthors,
    setFilterAuthors,
    filterPrograms,
    setFilterPrograms,
    filterMaxTime,
    setFilterMaxTime,
    filterMaxCalories,
    setFilterMaxCalories,
    allAuthors,
    allPrograms,
    filteredRecipes,
    hasActiveFilters,
    resetFilters,
  };
}
