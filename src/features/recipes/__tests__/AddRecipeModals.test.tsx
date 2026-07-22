// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RepositoryContext } from '@/app/providers/RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';
import { AddRecipeModals, type RecipeFormData } from '../AddRecipeModals';

vi.mock('@/services/ai/aiClient', () => ({
  aiClient: {
    generateImage: vi.fn().mockRejectedValue(new Error('generateImage upstream failure')),
  },
}));

vi.mock('@/shared/utils/pdfUtils', () => ({
  extractImageFromPDF: vi.fn(),
  extractTextFromPDF: vi.fn(),
}));

const manualFormData: RecipeFormData = {
  title: 'Тестовый рецепт',
  author: '',
  sourceUrl: '',
  image: null,
  time: '',
  servings: 2,
  categories: [],
  ingredients: 'Курица',
  steps: '',
  calories: 0,
  proteins: 0,
  fats: 0,
  carbs: 0,
  substitutions: '',
};

describe('AddRecipeModals — handleAddManual', () => {
  let fakeRecipesRepo: FakeRecipesRepository;
  let fakeRepos: {
    recipes: FakeRecipesRepository;
    planner: FakePlannerRepository;
    cart: FakeCartRepository;
    programs: FakeProgramsRepository;
    userProfile: FakeUserProfileRepository;
    nutritionPlan: FakeNutritionPlanRepository;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fakeRecipesRepo = new FakeRecipesRepository();
    fakeRepos = {
      recipes: fakeRecipesRepo,
      planner: new FakePlannerRepository(),
      cart: new FakeCartRepository(),
      programs: new FakeProgramsRepository(),
      userProfile: new FakeUserProfileRepository(),
      nutritionPlan: new FakeNutritionPlanRepository(),
    };
  });

  it('сохраняет рецепт без фото, даже если генерация изображения падает', async () => {
    render(
      <RepositoryContext.Provider value={fakeRepos}>
        <AddRecipeModals
          recipes={[]}
          programs={[]}
          availableCategories={[]}
          recipeTarget={null}
          onRecipeTargetCleared={vi.fn()}
          photoInputRef={{ current: null }}
          selectedRecipe={null}
          onSelectedRecipeChange={vi.fn()}
          isAddingManual={true}
          onIsAddingManualChange={vi.fn()}
          isAddingPDF={false}
          onIsAddingPDFChange={vi.fn()}
          isAddingLink={false}
          onIsAddingLinkChange={vi.fn()}
          isScanning={false}
          onIsScanningChange={vi.fn()}
          formData={manualFormData}
          onFormDataChange={vi.fn()}
          editingId={null}
          onEditingIdChange={vi.fn()}
          productFormData={{ name: '', amount: '', calories: 0, proteins: 0, fats: 0, carbs: 0 }}
          onProductFormDataChange={vi.fn()}
          isAddingProductToRecipe={false}
          onIsAddingProductToRecipeChange={vi.fn()}
          recipeLink=""
          onRecipeLinkChange={vi.fn()}
          isDeleteConfirmOpen={false}
          onIsDeleteConfirmOpenChange={vi.fn()}
        />
      </RepositoryContext.Provider>,
    );

    const addSpy = vi.spyOn(fakeRecipesRepo, 'add');

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить рецепт' }));

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledTimes(1);
    });
    expect(addSpy.mock.calls[0]![0]).toMatchObject({ title: 'Тестовый рецепт', image: undefined });
  });
});
