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
import { RecipesView } from '../RecipesView';

// RecipesView pulls in AddRecipeModals, which imports pdfjs-dist transitively.
// pdfjs-dist references DOMMatrix at module load time, which jsdom doesn't provide —
// mock it out the same way AddRecipeModals.test.tsx does.
vi.mock('@/shared/utils/pdfUtils', () => ({
  extractImageFromPDF: vi.fn(),
  extractTextFromPDF: vi.fn(),
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

const recipe1: Recipe = {
  id: 'r1',
  title: 'Овсянка с ягодами',
  time: '15 мин',
  servings: 2,
  categories: ['Завтрак'],
  ingredients: ['Овсянка'],
  steps: ['Смешать'],
  macros: { calories: 350, proteins: 20, fats: 10, carbs: 40 },
  isFavorite: false,
  createdAt: '2024-01-01',
};

const recipe2: Recipe = {
  id: 'r2',
  title: 'Куриный суп',
  time: '40 мин',
  servings: 4,
  categories: ['Обед'],
  ingredients: ['Курица'],
  steps: ['Варить'],
  macros: { calories: 250, proteins: 25, fats: 8, carbs: 15 },
  isFavorite: false,
  createdAt: '2024-01-02',
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

const noop = vi.fn();

function renderView(recipes: Recipe[]) {
  return render(
    <Wrapper>
      <RecipesView
        recipes={recipes}
        programs={[]}
        availableCategories={[]}
        userProfile={mockProfile}
        onOpenSettings={noop}
        photoInputRef={{ current: null }}
        recipeTarget={null}
        onRecipeTargetCleared={noop}
        isRecipeSelectionMode={false}
        selectedRecipeIds={[]}
        onSelectedRecipeIdsChange={noop}
        selectedRecipe={null}
        onSelectedRecipeChange={noop}
        isAddingManual={false}
        onIsAddingManualChange={noop}
        isAddingLink={false}
        onIsAddingLinkChange={noop}
        isAddingPDF={false}
        onIsAddingPDFChange={noop}
        isScanning={false}
        onIsScanningChange={noop}
      />
    </Wrapper>,
  );
}

describe('RecipesView', () => {
  it('renders both recipe titles and the toolbar', () => {
    renderView([recipe1, recipe2]);

    expect(screen.getByText('Овсянка с ягодами')).toBeInTheDocument();
    expect(screen.getByText('Куриный суп')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Поиск рецептов...')).toBeInTheDocument();
  });

  it('hides the non-matching recipe when searching', () => {
    renderView([recipe1, recipe2]);

    fireEvent.change(screen.getByPlaceholderText('Поиск рецептов...'), {
      target: { value: 'Овсянка' },
    });

    expect(screen.getByText('Овсянка с ягодами')).toBeInTheDocument();
    expect(screen.queryByText('Куриный суп')).not.toBeInTheDocument();
  });
});
