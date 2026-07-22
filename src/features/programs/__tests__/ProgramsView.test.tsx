// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DataContext } from '@/app/providers/DataContext';
import { RepositoryContext } from '@/app/providers/RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';
import type { Program, UserProfile } from '@/shared/domain/types';
import { ProgramsView } from '../ProgramsView';

// ProgramsView imports pdfUtils (pdfjs-dist) directly for PDF program import.
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

const program: Program = {
  id: 'p1',
  name: 'Похудение за 30 дней',
  description: 'Программа питания',
  creator: 'Тренер Иван',
  link: '',
  recipeIds: [],
  createdAt: '2024-01-01',
};

const emptyData = { recipes: [], plannerEntries: [], cartItems: [], programs: [] };

const fakeRepos = {
  recipes: new FakeRecipesRepository(),
  planner: new FakePlannerRepository(),
  cart: new FakeCartRepository(),
  programs: new FakeProgramsRepository(),
  userProfile: new FakeUserProfileRepository(),
  nutritionPlan: new FakeNutritionPlanRepository(),
};

function Wrapper({ children, programs = [] }: { children: ReactNode; programs?: Program[] }) {
  return (
    <RepositoryContext.Provider value={fakeRepos}>
      <DataContext.Provider value={{ ...emptyData, programs }}>{children}</DataContext.Provider>
    </RepositoryContext.Provider>
  );
}

const noop = vi.fn();
const noopAsync = vi.fn(async () => {});

function baseProps() {
  return {
    recipes: [],
    availableCategories: [],
    userProfile: mockProfile,
    openProgramId: null,
    onOpenProgramIdChange: noop,
    isRecipeSelectionMode: false,
    selectionTarget: null,
    selectedRecipeIds: [],
    onSelectedRecipeIdsChange: noop,
    onStartRecipeSelection: noop,
    onAddSelectedRecipes: noopAsync,
    onRecipeTargetSet: noop,
    photoInputRef: { current: null },
    onIsAddingManualChange: noop,
    onIsAddingLinkChange: noop,
    onIsAddingPDFChange: noop,
    onIsScanningChange: noop,
    onSelectRecipe: noop,
  };
}

describe('ProgramsView', () => {
  it('shows the empty-state message when there are no programs', () => {
    render(
      <Wrapper programs={[]}>
        <ProgramsView {...baseProps()} />
      </Wrapper>,
    );

    expect(screen.getByText('У вас пока нет программ')).toBeInTheDocument();
  });

  it('renders a program name and fires onOpenProgramIdChange when clicked', () => {
    const onOpenProgramIdChange = vi.fn();
    render(
      <Wrapper programs={[program]}>
        <ProgramsView {...baseProps()} onOpenProgramIdChange={onOpenProgramIdChange} />
      </Wrapper>,
    );

    const name = screen.getByText('Похудение за 30 дней');
    expect(name).toBeInTheDocument();

    fireEvent.click(name);
    expect(onOpenProgramIdChange).toHaveBeenCalledWith('p1');
  });
});
