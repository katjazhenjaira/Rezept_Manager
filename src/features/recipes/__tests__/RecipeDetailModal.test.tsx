// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RepositoryContext } from '@/app/providers/RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';
import type { Recipe, UserProfile } from '@/shared/domain/types';
import { RecipeDetailModal } from '../RecipeDetailModal';

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
  time: '15 мин',
  servings: 2,
  categories: ['Завтрак'],
  ingredients: ['Овсянка', 'Ягоды'],
  steps: ['Смешать овсянку с молоком', 'Добавить ягоды'],
  macros: { calories: 350, proteins: 20, fats: 10, carbs: 40 },
  isFavorite: false,
  createdAt: '2024-01-01',
};

const fakeRepos = {
  recipes: new FakeRecipesRepository(),
  planner: new FakePlannerRepository(),
  cart: new FakeCartRepository(),
  programs: new FakeProgramsRepository(),
  userProfile: new FakeUserProfileRepository(),
  nutritionPlan: new FakeNutritionPlanRepository(),
};

function Wrapper({ children }: { children: ReactNode }) {
  return <RepositoryContext.Provider value={fakeRepos}>{children}</RepositoryContext.Provider>;
}

describe('RecipeDetailModal', () => {
  it('renders ingredients, steps and macros', () => {
    render(
      <Wrapper>
        <RecipeDetailModal
          recipe={recipe}
          programs={[]}
          userProfile={mockProfile}
          onSelectedRecipeChange={vi.fn()}
          onToggleFavorite={vi.fn()}
          onEdit={vi.fn()}
          onDeleteRequested={vi.fn()}
        />
      </Wrapper>,
    );

    expect(screen.getByText('Овсянка с ягодами')).toBeInTheDocument();
    expect(screen.getByText('Овсянка')).toBeInTheDocument();
    expect(screen.getByText('Ягоды')).toBeInTheDocument();
    expect(screen.getByText('Смешать овсянку с молоком')).toBeInTheDocument();
    expect(screen.getByText('350 ккал')).toBeInTheDocument();
  });

  it('fires onSelectedRecipeChange(null) when closed via the "Готово" button', () => {
    const onSelectedRecipeChange = vi.fn();
    render(
      <Wrapper>
        <RecipeDetailModal
          recipe={recipe}
          programs={[]}
          userProfile={mockProfile}
          onSelectedRecipeChange={onSelectedRecipeChange}
          onToggleFavorite={vi.fn()}
          onEdit={vi.fn()}
          onDeleteRequested={vi.fn()}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole('button', { name: /готово/i }));
    expect(onSelectedRecipeChange).toHaveBeenCalledWith(null);
  });

  it('closes via the accessible header "Закрыть" button', () => {
    const onSelectedRecipeChange = vi.fn();
    render(
      <Wrapper>
        <RecipeDetailModal
          recipe={recipe}
          programs={[]}
          userProfile={mockProfile}
          onSelectedRecipeChange={onSelectedRecipeChange}
          onToggleFavorite={vi.fn()}
          onEdit={vi.fn()}
          onDeleteRequested={vi.fn()}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(onSelectedRecipeChange).toHaveBeenCalledWith(null);
  });

  it('fires onToggleFavorite from the accessible favorite button', () => {
    const onToggleFavorite = vi.fn();
    render(
      <Wrapper>
        <RecipeDetailModal
          recipe={recipe}
          programs={[]}
          userProfile={mockProfile}
          onSelectedRecipeChange={vi.fn()}
          onToggleFavorite={onToggleFavorite}
          onEdit={vi.fn()}
          onDeleteRequested={vi.fn()}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'В избранное' }));
    expect(onToggleFavorite).toHaveBeenCalledWith('r1');
  });
});
