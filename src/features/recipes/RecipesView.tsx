import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useRepositories } from '@/app/providers/RepositoryContext';
import type { Recipe, UserProfile, Program } from '@/shared/domain/types';
import { RecipesEmptyState } from './RecipesEmptyState';
import { RecipeCard } from './RecipeCard';
import { RecipesToolbar } from './RecipesToolbar';
import { RecipeFilterSidebar } from './RecipeFilterSidebar';
import { useRecipeFilters } from './useRecipeFilters';
import { AddRecipeModals, type RecipeFormData, type ProductFormData } from './AddRecipeModals';
import { RecipeDetailModal } from './RecipeDetailModal';

// ─── Props ────────────────────────────────────────────────────────────────────

export type RecipesViewProps = {
  recipes: Recipe[];
  programs: Program[];
  availableCategories: string[];
  userProfile: UserProfile;
  onOpenSettings: () => void;
  // Cross-tab: photo import ref (Programs tab can also trigger click)
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  // Cross-tab: recipe target (when adding recipe from Programs tab context)
  recipeTarget: { programId: string; subfolderId: string | 'main' } | null;
  onRecipeTargetCleared: () => void;
  // Cross-tab: recipe selection mode (initiated by Programs tab)
  isRecipeSelectionMode: boolean;
  selectedRecipeIds: string[];
  onSelectedRecipeIdsChange: (ids: string[]) => void;
  // Cross-tab controlled state (Programs/Planner can trigger modals/detail)
  selectedRecipe: Recipe | null;
  onSelectedRecipeChange: (r: Recipe | null) => void;
  isAddingManual: boolean;
  onIsAddingManualChange: (v: boolean) => void;
  isAddingLink: boolean;
  onIsAddingLinkChange: (v: boolean) => void;
  isAddingPDF: boolean;
  onIsAddingPDFChange: (v: boolean) => void;
  isScanning: boolean;
  onIsScanningChange: (v: boolean) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RecipesView({
  recipes,
  programs,
  availableCategories,
  userProfile,
  onOpenSettings,
  photoInputRef,
  recipeTarget,
  onRecipeTargetCleared,
  isRecipeSelectionMode,
  selectedRecipeIds,
  onSelectedRecipeIdsChange,
  selectedRecipe,
  onSelectedRecipeChange: setSelectedRecipe,
  isAddingManual,
  onIsAddingManualChange: setIsAddingManual,
  isAddingLink,
  onIsAddingLinkChange: setIsAddingLink,
  isAddingPDF,
  onIsAddingPDFChange: setIsAddingPDF,
  isScanning,
  onIsScanningChange: setIsScanning,
}: RecipesViewProps) {
  const { recipes: recipesRepo } = useRepositories();

  // ── View / filter state ─────────────────────────────────────────────────────
  const {
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
  } = useRecipeFilters(recipes, programs);

  // ── Recipe detail / editing state ──────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recipeLink, setRecipeLink] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // ── Recipe form state ───────────────────────────────────────────────────────
  const [formData, setFormData] = useState<RecipeFormData>({
    title: '',
    author: '',
    sourceUrl: '',
    image: '' as string | null,
    time: '',
    servings: 2,
    categories: [] as string[],
    ingredients: '',
    steps: '',
    calories: 0,
    proteins: 0,
    fats: 0,
    carbs: 0,
    substitutions: '',
  });

  // ── Product-in-recipe form state ────────────────────────────────────────────
  const [isAddingProductToRecipe, setIsAddingProductToRecipe] = useState(false);
  const [productFormData, setProductFormData] = useState<ProductFormData>({
    name: '',
    amount: '',
    calories: 0,
    proteins: 0,
    fats: 0,
    carbs: 0,
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const toggleFavorite = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) return;
    try {
      await recipesRepo.update(id, { isFavorite: !recipe.isFavorite });
      if (selectedRecipe?.id === id) {
        setSelectedRecipe({ ...selectedRecipe, isFavorite: !selectedRecipe.isFavorite });
      }
    } catch (error) {
      console.error('Error updating favorite status:', error);
    }
  };

  const handleEdit = (recipe: Recipe) => {
    setEditingId(recipe.id);
    setFormData({
      title: recipe.title,
      author: recipe.author || '',
      sourceUrl: recipe.sourceUrl || '',
      image: recipe.image || null,
      time: recipe.time,
      servings: recipe.servings,
      categories: recipe.categories,
      ingredients: recipe.ingredients.join('\n'),
      steps: recipe.steps.join('\n'),
      calories: recipe.macros.calories,
      proteins: recipe.macros.proteins,
      fats: recipe.macros.fats,
      carbs: recipe.macros.carbs,
      substitutions: recipe.substitutions || '',
    });
    setIsAddingManual(true);
    setSelectedRecipe(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Toolbar (sticky below global header) ── */}
      <RecipesToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        recipeView={recipeView}
        onRecipeViewChange={setRecipeView}
        hasActiveFilters={hasActiveFilters}
        filterSortBy={filterSortBy}
        onFilterSortByChange={setFilterSortBy}
        availableCategories={availableCategories}
        onOpenSettings={onOpenSettings}
        filterCategories={filterCategories}
        onToggleFilterCategory={toggleFilterCategory}
        filterAuthors={filterAuthors}
        onFilterAuthorsChange={setFilterAuthors}
        allAuthors={allAuthors}
        filterPrograms={filterPrograms}
        onFilterProgramsChange={setFilterPrograms}
        allPrograms={allPrograms}
        filterMaxTime={filterMaxTime}
        onFilterMaxTimeChange={setFilterMaxTime}
        filterMaxCalories={filterMaxCalories}
        onFilterMaxCaloriesChange={setFilterMaxCalories}
        onResetFilters={resetFilters}
        photoInputRef={photoInputRef}
        onAddPDF={() => setIsAddingPDF(true)}
        onAddLink={() => setIsAddingLink(true)}
        onAddManual={() => setIsAddingManual(true)}
      />

      {/* ── Main content area ── */}
      <div className="max-w-7xl mx-auto px-4 py-8 pb-32">
        {recipes.length === 0 ? (
          <RecipesEmptyState
            photoInputRef={photoInputRef}
            onAddPDF={() => setIsAddingPDF(true)}
            onAddLink={() => setIsAddingLink(true)}
            onAddManual={() => setIsAddingManual(true)}
          />
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar for Desktop */}
            <RecipeFilterSidebar
              recipes={recipes}
              recipeView={recipeView}
              onRecipeViewChange={setRecipeView}
              onOpenSettings={onOpenSettings}
              availableCategories={availableCategories}
              filterCategories={filterCategories}
              onToggleFilterCategory={toggleFilterCategory}
              filterAuthors={filterAuthors}
              onFilterAuthorsChange={setFilterAuthors}
              allAuthors={allAuthors}
              filterPrograms={filterPrograms}
              onFilterProgramsChange={setFilterPrograms}
              allPrograms={allPrograms}
              filterMaxTime={filterMaxTime}
              onFilterMaxTimeChange={setFilterMaxTime}
              filterMaxCalories={filterMaxCalories}
              onFilterMaxCaloriesChange={setFilterMaxCalories}
            />

            {/* Main Grid Area */}
            <div className="flex-1 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold font-display">
                    {recipeView === 'all'
                      ? 'Все рецепты'
                      : recipeView === 'favorites'
                        ? 'Избранное'
                        : 'Сборники'}
                  </h2>
                  <p className="text-zinc-500 text-sm">Найдено: {filteredRecipes.length}</p>
                </div>
              </div>

              {filteredRecipes.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                    <Search className="w-8 h-8" />
                  </div>
                  <p className="text-zinc-500">Ничего не найдено по вашим критериям</p>
                  <button
                    onClick={() => {
                      resetFilters();
                      setSearchQuery('');
                    }}
                    className="text-emerald-600 font-bold hover:underline"
                  >
                    Сбросить фильтры
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {filteredRecipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      userProfile={userProfile}
                      isRecipeSelectionMode={isRecipeSelectionMode}
                      selectedRecipeIds={selectedRecipeIds}
                      onSelectedRecipeIdsChange={onSelectedRecipeIdsChange}
                      onSelectRecipe={setSelectedRecipe}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AddRecipeModals
        recipes={recipes}
        programs={programs}
        availableCategories={availableCategories}
        recipeTarget={recipeTarget}
        onRecipeTargetCleared={onRecipeTargetCleared}
        photoInputRef={photoInputRef}
        selectedRecipe={selectedRecipe}
        onSelectedRecipeChange={setSelectedRecipe}
        isAddingManual={isAddingManual}
        onIsAddingManualChange={setIsAddingManual}
        isAddingPDF={isAddingPDF}
        onIsAddingPDFChange={setIsAddingPDF}
        isAddingLink={isAddingLink}
        onIsAddingLinkChange={setIsAddingLink}
        isScanning={isScanning}
        onIsScanningChange={setIsScanning}
        formData={formData}
        onFormDataChange={setFormData}
        editingId={editingId}
        onEditingIdChange={setEditingId}
        productFormData={productFormData}
        onProductFormDataChange={setProductFormData}
        isAddingProductToRecipe={isAddingProductToRecipe}
        onIsAddingProductToRecipeChange={setIsAddingProductToRecipe}
        recipeLink={recipeLink}
        onRecipeLinkChange={setRecipeLink}
        isDeleteConfirmOpen={isDeleteConfirmOpen}
        onIsDeleteConfirmOpenChange={setIsDeleteConfirmOpen}
      />

      {/* Recipe Detail Modal */}
      <AnimatePresence>
        {selectedRecipe && (
          <RecipeDetailModal
            recipe={selectedRecipe}
            programs={programs}
            userProfile={userProfile}
            onSelectedRecipeChange={setSelectedRecipe}
            onToggleFavorite={toggleFavorite}
            onEdit={handleEdit}
            onDeleteRequested={() => setIsDeleteConfirmOpen(true)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
