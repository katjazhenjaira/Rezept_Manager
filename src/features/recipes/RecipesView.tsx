import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  Plus,
  Camera,
  Link as LinkIcon,
  Edit3,
  Search,
  Share2,
  FolderPlus,
  Trash2,
  Edit,
  Activity,
  Loader2,
  Check,
  ChefHat,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useRepositories } from '@/app/providers/RepositoryContext';
import { aiClient } from '@/services/ai/aiClient';
import { format } from 'date-fns';
import { recipeAllergens } from '@/shared/domain/allergies';
import type { Recipe, UserProfile, Program, Subfolder } from '@/shared/domain/types';
import { RecipesEmptyState } from './RecipesEmptyState';
import { RecipeCard } from './RecipeCard';
import { RecipesToolbar } from './RecipesToolbar';
import { RecipeFilterSidebar } from './RecipeFilterSidebar';
import { useRecipeFilters } from './useRecipeFilters';
import { AddRecipeModals, type RecipeFormData, type ProductFormData } from './AddRecipeModals';

// ─── Utility ─────────────────────────────────────────────────────────────────

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  const { recipes: recipesRepo, programs: programsRepo, planner: plannerRepo } = useRepositories();

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
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);
  const [isRecalculatingKbzhu, setIsRecalculatingKbzhu] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [recipeLink, setRecipeLink] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isCollectionPickerOpen, setIsCollectionPickerOpen] = useState(false);
  // Эфемерный калькулятор «на сколько порций считать КБЖУ» — не меняет и не сохраняет recipe.servings
  const [portionCount, setPortionCount] = useState(1);

  useEffect(() => {
    if (selectedRecipe) {
      setPortionCount(Math.max(1, selectedRecipe.servings));
    }
  }, [selectedRecipe?.id]);

  // ── Planning state ──────────────────────────────────────────────────────────
  const [isPlanning, setIsPlanning] = useState(false);
  const [planDetails, setPlanDetails] = useState({
    day: format(new Date(), 'yyyy-MM-dd'),
    meal: 'Завтрак',
  });

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

  const handleShareRecipe = (recipeId: string) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?recipeId=${recipeId}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Ссылка скопирована в буфер обмена!');
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

  const handleAddToPlanner = async (date: string, mealType: string, recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (recipe) {
      const allergens = recipeAllergens(recipe, userProfile.allergies);
      if (allergens.length > 0) {
        if (
          !confirm(
            `Осторожно! Этот рецепт содержит ингредиенты, на которые у вас аллергия: ${allergens.join(', ')}. Все равно добавить?`,
          )
        ) {
          return;
        }
      }
    }

    try {
      await plannerRepo.add({ date, mealType, type: 'recipe', recipeId });
      setIsPlanning(false);
      alert('Добавлено в календарь');
    } catch (error) {
      console.error('Error adding to planner:', error);
      alert('Ошибка при добавлении в календарь');
    }
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedRecipe(null);
                setIsPlanning(false);
              }}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-bold font-display text-zinc-900">
                    {selectedRecipe.title}
                  </h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedRecipe.categories.map((cat) => (
                      <span
                        key={cat}
                        className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded"
                      >
                        {cat}
                      </span>
                    ))}
                    {selectedRecipe.sourceUrl && (
                      <a
                        href={selectedRecipe.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-zinc-200 transition-colors"
                      >
                        <LinkIcon className="w-3 h-3" />
                        Источник
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleEdit(selectedRecipe);
                      setSelectedRecipe(null);
                    }}
                    className="w-10 h-10 bg-zinc-50 border border-zinc-100 text-zinc-400 rounded-full flex items-center justify-center hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    title="Редактировать"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => toggleFavorite(selectedRecipe.id)}
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all border',
                      selectedRecipe.isFavorite
                        ? 'bg-red-50 border-red-100 text-red-500'
                        : 'bg-zinc-50 border-zinc-100 text-zinc-400 hover:text-red-500',
                    )}
                  >
                    <Activity
                      className={cn('w-5 h-5', selectedRecipe.isFavorite && 'fill-current')}
                    />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRecipe(null);
                      setIsPlanning(false);
                    }}
                    className="w-10 h-10 bg-zinc-100 text-zinc-500 rounded-full flex items-center justify-center hover:bg-zinc-200 transition-colors"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Photo Section */}
                <div className="relative h-64 sm:h-96 bg-zinc-100 group/photo">
                  <img
                    src={
                      selectedRecipe.image ||
                      `https://picsum.photos/seed/${selectedRecipe.id}/1200/800`
                    }
                    alt={selectedRecipe.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />

                  {isUpdatingImage && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-20">
                      <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover/photo:opacity-100">
                    <label className="bg-white px-6 py-3 rounded-2xl text-sm font-bold text-zinc-900 flex items-center gap-2 shadow-2xl cursor-pointer hover:scale-105 transition-all active:scale-95">
                      <Camera className="w-5 h-5 text-emerald-600" />
                      Изменить фото
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file && selectedRecipe) {
                            setIsUpdatingImage(true);
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const base64 = reader.result as string;
                              try {
                                await recipesRepo.update(selectedRecipe.id, { image: base64 });
                                setSelectedRecipe({ ...selectedRecipe, image: base64 });
                                setShowSaveSuccess(true);
                                setTimeout(() => setShowSaveSuccess(false), 3000);
                              } catch (err) {
                                console.error('Error updating image:', err);
                                alert('Ошибка при обновлении фото');
                              } finally {
                                setIsUpdatingImage(false);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>

                  <AnimatePresence>
                    {showSaveSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 z-30 font-bold"
                      >
                        <Check className="w-5 h-5" />
                        Фото сохранено!
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="p-6 md:p-8 space-y-10">
                  {/* Action Buttons Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                    <button
                      onClick={() => setIsPlanning(!isPlanning)}
                      className={cn(
                        'flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all gap-2',
                        isPlanning
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100'
                          : 'bg-white border-zinc-100 text-zinc-600 hover:bg-zinc-50',
                      )}
                    >
                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-[10px] sm:text-xs font-bold">В план</span>
                    </button>
                    <button
                      onClick={() => setIsCollectionPickerOpen(!isCollectionPickerOpen)}
                      className={cn(
                        'flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all gap-2',
                        isCollectionPickerOpen
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100'
                          : 'bg-white border-zinc-100 text-zinc-600 hover:bg-zinc-50',
                      )}
                    >
                      <FolderPlus className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-[10px] sm:text-xs font-bold">Сборники</span>
                    </button>
                    <button
                      onClick={() => handleShareRecipe(selectedRecipe.id)}
                      className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white border border-zinc-100 rounded-2xl text-zinc-600 hover:bg-zinc-50 transition-all gap-2"
                    >
                      <Share2 className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-[10px] sm:text-xs font-bold">Поделиться</span>
                    </button>
                    <button
                      onClick={() => handleEdit(selectedRecipe)}
                      className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white border border-zinc-100 rounded-2xl text-zinc-600 hover:bg-zinc-50 transition-all gap-2"
                    >
                      <Edit className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-[10px] sm:text-xs font-bold">Изменить</span>
                    </button>
                    <button
                      onClick={() => setIsDeleteConfirmOpen(true)}
                      className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white border border-red-100 rounded-2xl text-red-500 hover:bg-red-50 transition-all gap-2"
                    >
                      <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="text-[10px] sm:text-xs font-bold">Удалить</span>
                    </button>
                  </div>

                  {/* Collections Selection UI */}
                  <AnimatePresence>
                    {isCollectionPickerOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-emerald-900">Добавить в сборник</h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {programs.map((program) => {
                              const isInProgram = program.recipeIds.includes(selectedRecipe.id);
                              return (
                                <button
                                  key={program.id}
                                  onClick={async () => {
                                    const newRecipeIds = isInProgram
                                      ? program.recipeIds.filter((id) => id !== selectedRecipe.id)
                                      : [...program.recipeIds, selectedRecipe.id];
                                    try {
                                      await programsRepo.update(program.id, {
                                        recipeIds: newRecipeIds,
                                      });
                                    } catch (err) {
                                      console.error('Error updating program:', err);
                                    }
                                  }}
                                  className={cn(
                                    'flex items-center justify-between p-3 rounded-xl border transition-all text-sm font-medium',
                                    isInProgram
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'bg-white border-emerald-100 text-emerald-700 hover:bg-emerald-100',
                                  )}
                                >
                                  <span className="truncate">{program.name}</span>
                                  {isInProgram && <Check className="w-4 h-4" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Planning UI */}
                  <AnimatePresence>
                    {isPlanning && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-4">
                          <h4 className="font-bold text-emerald-900">Добавить в план питания</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-emerald-700 uppercase">
                                День
                              </label>
                              <input
                                type="date"
                                value={planDetails.day}
                                onChange={(e) =>
                                  setPlanDetails({ ...planDetails, day: e.target.value })
                                }
                                className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-emerald-700 uppercase">
                                Приём пищи
                              </label>
                              <select
                                value={planDetails.meal}
                                onChange={(e) =>
                                  setPlanDetails({ ...planDetails, meal: e.target.value })
                                }
                                className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                              >
                                <option>Завтрак</option>
                                <option>Обед</option>
                                <option>Ужин</option>
                                <option>Перекус</option>
                              </select>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              handleAddToPlanner(
                                planDetails.day,
                                planDetails.meal,
                                selectedRecipe.id,
                              )
                            }
                            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                          >
                            Подтвердить
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Left Column: Ingredients & Macros */}
                    <div className="md:col-span-1 space-y-10">
                      <div>
                        <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                          <ChefHat className="w-5 h-5 text-emerald-600" />
                          Ингредиенты
                        </h4>
                        <ul className="space-y-3">
                          {selectedRecipe.ingredients.map((ing, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-3 text-zinc-600 text-sm leading-relaxed"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                              {ing}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-4">
                          КБЖУ (на {portionCount} {portionCount === 1 ? 'порцию' : 'порций'})
                        </p>
                        {(() => {
                          const servingsBase = Math.max(1, selectedRecipe.servings);
                          const scaledMacros = {
                            calories: Math.round(
                              (selectedRecipe.macros.calories * portionCount) / servingsBase,
                            ),
                            proteins: Math.round(
                              (selectedRecipe.macros.proteins * portionCount) / servingsBase,
                            ),
                            fats: Math.round(
                              (selectedRecipe.macros.fats * portionCount) / servingsBase,
                            ),
                            carbs: Math.round(
                              (selectedRecipe.macros.carbs * portionCount) / servingsBase,
                            ),
                          };
                          return (
                            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                              <div>
                                <p className="text-xs text-emerald-800/60 mb-0.5">Калории</p>
                                <p className="font-bold text-lg text-emerald-900">
                                  {scaledMacros.calories} ккал
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-emerald-800/60 mb-0.5">Белки</p>
                                <p className="font-bold text-lg text-emerald-900">
                                  {scaledMacros.proteins}г
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-emerald-800/60 mb-0.5">Жиры</p>
                                <p className="font-bold text-lg text-emerald-900">
                                  {scaledMacros.fats}г
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-emerald-800/60 mb-0.5">Углеводы</p>
                                <p className="font-bold text-lg text-emerald-900">
                                  {scaledMacros.carbs}г
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                        <button
                          onClick={async () => {
                            setIsRecalculatingKbzhu(true);
                            try {
                              const data = await aiClient.calculateKbzhu({
                                ingredients: selectedRecipe.ingredients.join('\n'),
                              });
                              const servings = Math.max(1, selectedRecipe.servings);
                              const macros = {
                                calories: Math.round((data.calories || 0) / servings),
                                proteins: Math.round((data.proteins || 0) / servings),
                                fats: Math.round((data.fats || 0) / servings),
                                carbs: Math.round((data.carbs || 0) / servings),
                              };
                              await recipesRepo.update(selectedRecipe.id, { macros });
                              setSelectedRecipe({ ...selectedRecipe, macros });
                            } catch (e) {
                              console.error(e);
                              alert('Не удалось пересчитать КБЖУ. Проверьте список ингредиентов.');
                            } finally {
                              setIsRecalculatingKbzhu(false);
                            }
                          }}
                          disabled={isRecalculatingKbzhu}
                          className="mt-4 w-full flex items-center justify-center gap-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-200 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                        >
                          {isRecalculatingKbzhu ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Activity className="w-3.5 h-3.5" />
                          )}
                          Пересчитать КБЖУ
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Steps & Others */}
                    <div className="md:col-span-2 space-y-10">
                      <div>
                        <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                          <Edit3 className="w-5 h-5 text-emerald-600" />
                          Пошаговое приготовление
                        </h4>
                        <div className="space-y-8">
                          {selectedRecipe.steps.map((step, i) => (
                            <div key={i} className="flex gap-5">
                              <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center font-bold text-zinc-500 flex-shrink-0 text-sm">
                                {i + 1}
                              </div>
                              <p className="text-zinc-600 leading-relaxed pt-2">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                            Время приготовления
                          </p>
                          <div className="flex items-center gap-2 text-zinc-700 font-bold">
                            <Calendar className="w-4 h-4 text-emerald-500" />
                            {selectedRecipe.time}
                          </div>
                        </div>
                        <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                            Расчёт КБЖУ на порций
                          </p>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPortionCount((c) => Math.max(1, c - 1));
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-white border border-zinc-200 rounded-lg text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                            >
                              -
                            </button>
                            <p className="font-bold text-zinc-700 min-w-[20px] text-center">
                              {portionCount}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPortionCount((c) => c + 1);
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-white border border-zinc-200 rounded-lg text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                            >
                              +
                            </button>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-2">
                            Не меняет и не сохраняет рецепт — только пересчитывает КБЖУ
                          </p>
                        </div>
                      </div>

                      {selectedRecipe.substitutions && (
                        <div className="p-8 bg-zinc-50 rounded-3xl border border-zinc-100">
                          <h4 className="font-bold mb-3 text-zinc-800 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-500" />
                            Замена ингредиентов и советы
                          </h4>
                          <p className="text-zinc-600 text-sm leading-relaxed">
                            {selectedRecipe.substitutions}
                          </p>
                        </div>
                      )}

                      <div className="pt-6 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">
                              Автор / Создатель
                            </p>
                            <p className="font-bold text-zinc-700">
                              {selectedRecipe.author || 'Не указан'}
                            </p>
                          </div>
                        </div>
                        {selectedRecipe.sourceUrl && (
                          <a
                            href={selectedRecipe.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-5 py-2.5 rounded-xl font-bold transition-all text-sm"
                          >
                            <LinkIcon className="w-4 h-4" />
                            <span>Источник рецепта</span>
                          </a>
                        )}
                      </div>
                      <div className="pt-10 flex justify-center">
                        <button
                          onClick={() => {
                            setSelectedRecipe(null);
                            setIsPlanning(false);
                          }}
                          className="w-full sm:w-auto px-12 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-2"
                        >
                          <Check className="w-5 h-5" />
                          Готово
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
