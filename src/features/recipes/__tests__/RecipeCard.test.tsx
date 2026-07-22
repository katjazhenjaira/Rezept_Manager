// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Recipe, UserProfile } from '@/shared/domain/types';
import { RecipeCard } from '../RecipeCard';

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

const recipe: Recipe = {
  id: 'r1',
  title: 'Овсянка с ягодами',
  author: 'Аня',
  time: '15 мин',
  servings: 2,
  categories: ['Завтрак'],
  ingredients: ['Овсянка', 'Ягоды'],
  steps: ['Смешать'],
  macros: { calories: 350, proteins: 20, fats: 10, carbs: 40 },
  isFavorite: false,
  createdAt: '2024-01-01',
};

describe('RecipeCard', () => {
  it('renders title and macros', () => {
    render(
      <RecipeCard
        recipe={recipe}
        userProfile={mockProfile}
        isRecipeSelectionMode={false}
        selectedRecipeIds={[]}
        onSelectedRecipeIdsChange={vi.fn()}
        onSelectRecipe={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );

    expect(screen.getByText('Овсянка с ягодами')).toBeInTheDocument();
    expect(screen.getByText('350')).toBeInTheDocument();
    expect(screen.getByText('15 мин')).toBeInTheDocument();
  });

  it('fires onSelectRecipe when the card is clicked', () => {
    const onSelectRecipe = vi.fn();
    render(
      <RecipeCard
        recipe={recipe}
        userProfile={mockProfile}
        isRecipeSelectionMode={false}
        selectedRecipeIds={[]}
        onSelectedRecipeIdsChange={vi.fn()}
        onSelectRecipe={onSelectRecipe}
        onToggleFavorite={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Овсянка с ягодами'));
    expect(onSelectRecipe).toHaveBeenCalledWith(recipe);
  });

  it('fires onToggleFavorite when the favorite button is clicked', () => {
    // stopPropagation matches how real callers (e.g. RecipesView.toggleFavorite) use this prop,
    // preventing the click from bubbling up to the card's own onClick.
    const onToggleFavorite = vi.fn((_id: string, e?: React.MouseEvent) => e?.stopPropagation());
    const onSelectRecipe = vi.fn();
    render(
      <RecipeCard
        recipe={recipe}
        userProfile={mockProfile}
        isRecipeSelectionMode={false}
        selectedRecipeIds={[]}
        onSelectedRecipeIdsChange={vi.fn()}
        onSelectRecipe={onSelectRecipe}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onToggleFavorite).toHaveBeenCalledWith('r1', expect.anything());
    expect(onSelectRecipe).not.toHaveBeenCalled();
  });
});
