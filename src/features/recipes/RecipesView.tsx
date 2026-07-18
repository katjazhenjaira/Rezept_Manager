import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  Users,
  Plus,
  Camera,
  FileText,
  Link as LinkIcon,
  Edit3,
  Search,
  ChevronRight,
  Share2,
  FolderPlus,
  Trash2,
  Edit,
  Activity,
  Filter,
  Download,
  Loader2,
  Check,
  Settings,
  AlertTriangle,
  ChevronDown,
  Upload,
  ChefHat,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import { aiClient } from '@/services/ai/aiClient';
import { format } from 'date-fns';
import type { Recipe, UserProfile, Program, RecipeView, Subfolder } from '@/shared/domain/types';
import { extractImageFromPDF } from '@/shared/utils/pdfUtils';

// ─── Utility ─────────────────────────────────────────────────────────────────

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

const cropImage = (
  base64: string,
  box: { ymin: number; xmin: number; ymax: number; xmax: number },
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }

      const x = (box.xmin / 1000) * img.width;
      const y = (box.ymin / 1000) * img.height;
      const width = ((box.xmax - box.xmin) / 1000) * img.width;
      const height = ((box.ymax - box.ymin) / 1000) * img.height;

      if (width <= 0 || height <= 0) {
        resolve(base64);
        return;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const AddRecipeOption = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-3 transition-colors"
  >
    {icon}
    {label}
  </button>
);

function SidebarItem({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200',
        active
          ? 'bg-emerald-50 text-emerald-700 font-bold'
          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      {count !== undefined && (
        <span
          className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-md font-bold',
            active ? 'bg-emerald-200 text-emerald-800' : 'bg-zinc-200 text-zinc-500',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-2xl hover:border-emerald-500 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-zinc-50 rounded-lg group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
          {icon}
        </div>
        <span className="font-medium text-zinc-700 group-hover:text-zinc-900">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
    </button>
  );
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
  selectionTarget: { programId: string; subfolderId: string | 'main' } | null;
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
  selectionTarget,
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
  // ── View state ──────────────────────────────────────────────────────────────
  const [recipeView, setRecipeView] = useState<RecipeView>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAddRecipeDropdownOpen, setIsAddRecipeDropdownOpen] = useState(false);
  const [filterSortBy, setFilterSortBy] = useState<'newest' | 'oldest' | 'time' | 'calories'>('newest');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterAuthors, setFilterAuthors] = useState<string[]>([]);
  const [filterPrograms, setFilterPrograms] = useState<string[]>([]);
  const [filterMaxTime, setFilterMaxTime] = useState<number>(120);
  const [filterMaxCalories, setFilterMaxCalories] = useState<number>(1000);

  // ── Recipe detail / editing state ──────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [recipeLink, setRecipeLink] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isCollectionPickerOpen, setIsCollectionPickerOpen] = useState(false);

  // ── Planning state ──────────────────────────────────────────────────────────
  const [isPlanning, setIsPlanning] = useState(false);
  const [planDetails, setPlanDetails] = useState({
    day: format(new Date(), 'yyyy-MM-dd'),
    meal: 'Завтрак',
  });

  // ── Recipe form state ───────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
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
  const [productFormData, setProductFormData] = useState({
    name: '',
    amount: '',
    calories: 0,
    proteins: 0,
    fats: 0,
    carbs: 0,
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const addRecipeToTarget = async (recipeId: string) => {
    if (!recipeTarget) return;
    const { programId, subfolderId } = recipeTarget;
    const program = programs.find((p) => p.id === programId);
    if (!program) return;

    if (subfolderId === 'main') {
      await updateDoc(doc(db, 'programs', programId), {
        recipeIds: [...program.recipeIds, recipeId],
      });
    } else {
      const newSubfolders = (program.subfolders ?? []).map((sf) =>
        sf.id === subfolderId ? { ...sf, recipeIds: [...sf.recipeIds, recipeId] } : sf,
      );
      await updateDoc(doc(db, 'programs', programId), { subfolders: newSubfolders });
    }
    onRecipeTargetCleared();
  };

  // ─── Filter computation ──────────────────────────────────────────────────────

  const allAuthors = Array.from(new Set(recipes.map((r) => r.author || '').filter(Boolean))).sort();
  const allPrograms = programs.map((p) => p.name).sort();

  const filteredRecipes = recipes
    .filter((recipe) => {
      const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesView =
        recipeView === 'all' || (recipeView === 'favorites' && recipe.isFavorite);
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
        return (
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
      if (filterSortBy === 'oldest')
        return (
          new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        );
      if (filterSortBy === 'time')
        return (parseInt(a.time) || 0) - (parseInt(b.time) || 0);
      if (filterSortBy === 'calories') return a.macros.calories - b.macros.calories;
      return 0;
    });

  // ─── Toggle helpers ──────────────────────────────────────────────────────────

  const toggleFilterCategory = (cat: string) => {
    setFilterCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const toggleFilterAuthor = (author: string) => {
    setFilterAuthors((prev) =>
      prev.includes(author) ? prev.filter((a) => a !== author) : [...prev, author],
    );
  };

  const toggleFilterProgram = (progName: string) => {
    setFilterPrograms((prev) =>
      prev.includes(progName) ? prev.filter((p) => p !== progName) : [...prev, progName],
    );
  };

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const toggleFavorite = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) return;
    try {
      await updateDoc(doc(db, 'recipes', id), { isFavorite: !recipe.isFavorite });
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

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    let imageUrl = formData.image;
    if (!imageUrl) {
      const generated = await aiClient.generateImage({
        title: formData.title,
        ingredients: formData.ingredients.split('\n'),
      });
      if (generated?.imageDataUri) imageUrl = generated.imageDataUri;
    }

    const recipeData = {
      title: formData.title,
      author: formData.author,
      sourceUrl: formData.sourceUrl,
      image: imageUrl,
      time: formData.time || '30 мин',
      servings: formData.servings,
      categories: formData.categories,
      ingredients: formData.ingredients
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      steps: formData.steps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      macros: {
        calories: formData.calories,
        proteins: formData.proteins,
        fats: formData.fats,
        carbs: formData.carbs,
      },
      substitutions: formData.substitutions,
      isFavorite: editingId ? recipes.find((r) => r.id === editingId)?.isFavorite : false,
      createdAt: editingId
        ? recipes.find((r) => r.id === editingId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'recipes', editingId), recipeData);
        if (selectedRecipe?.id === editingId) {
          setSelectedRecipe({ id: editingId, ...recipeData } as Recipe);
        }
      } else {
        const docRef = await addDoc(collection(db, 'recipes'), recipeData);
        if (recipeTarget) {
          await addRecipeToTarget(docRef.id);
        }
      }

      setIsAddingManual(false);
      setEditingId(null);
      setFormData({
        title: '',
        author: '',
        sourceUrl: '',
        image: null,
        time: '',
        servings: 2,
        categories: [],
        ingredients: '',
        steps: '',
        calories: 0,
        proteins: 0,
        fats: 0,
        carbs: 0,
        substitutions: '',
      });
    } catch (error) {
      console.error('Error saving recipe:', error);
      alert('Ошибка при сохранении рецепта');
    }
  };

  const analyzePhoto = async (
    images: { base64: string; mimeType: string }[],
    autoSave: boolean = false,
  ) => {
    setIsScanning(true);
    try {
      const result = await aiClient.importFromPhoto({ images, availableCategories });
      const r = result.recipe;

      const firstImageBase64 = images[0]?.base64 ?? '';
      let dishImage: string = firstImageBase64;
      if (r.dishBoundingBox) {
        dishImage = await cropImage(firstImageBase64, r.dishBoundingBox);
      }

      if (!dishImage) {
        const generated = await aiClient.generateImage({
          title: r.title,
          ingredients: r.ingredients,
        });
        if (generated?.imageDataUri) dishImage = generated.imageDataUri;
      }

      if (autoSave) {
        const recipeToSave = {
          title: r.title,
          author: '',
          sourceUrl: r.sourceUrl ?? '',
          image: dishImage,
          time: r.time,
          servings: r.servings,
          categories: r.categories,
          ingredients: r.ingredients,
          steps: r.steps,
          macros: r.macros,
          substitutions: '',
          isFavorite: false,
          createdAt: new Date().toISOString(),
        };
        const docRef = await addDoc(collection(db, 'recipes'), recipeToSave);
        if (recipeTarget) {
          await addRecipeToTarget(docRef.id);
        }
        setIsAddingManual(false);
        alert('Рецепт успешно распознан и сохранен!');
      } else {
        setFormData((prev) => ({
          ...prev,
          image: dishImage,
          title: r.title,
          sourceUrl: r.sourceUrl ?? '',
          time: r.time,
          servings: r.servings,
          categories: r.categories,
          ingredients: r.ingredients.join('\n'),
          steps: r.steps.join('\n'),
          calories: r.macros.calories,
          proteins: r.macros.proteins,
          fats: r.macros.fats,
          carbs: r.macros.carbs,
        }));
      }
    } catch (error) {
      console.error('Error analyzing photo:', error);
      alert(
        'Не удалось автоматически распознать текст на фото. Пожалуйста, заполните данные вручную.',
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeLink.trim()) return;

    setIsScanning(true);
    try {
      const result = await aiClient.importFromUrl({ url: recipeLink, availableCategories });
      const r = result.recipe;

      const imageToStore =
        r.dishImage && r.dishImage.length <= 800_000 ? r.dishImage : null;
      const recipeData = {
        title: r.title,
        author: r.author ?? '',
        image: imageToStore,
        sourceUrl: r.sourceUrl ?? recipeLink,
        time: r.time,
        servings: r.servings,
        categories: r.categories,
        ingredients: r.ingredients,
        steps: r.steps,
        macros: r.macros,
        isFavorite: false,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'recipes'), recipeData);
      if (recipeTarget) {
        await addRecipeToTarget(docRef.id);
      }

      setIsAddingLink(false);
      setRecipeLink('');
      alert('Рецепт успешно добавлен!');
    } catch (error) {
      console.error('Error scanning link:', error);
      alert(
        'Не удалось распознать рецепт по ссылке. Попробуйте другую ссылку или добавьте вручную.',
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddToPlanner = async (date: string, mealType: string, recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (recipe) {
      const allergens = userProfile.allergies.filter((allergy) =>
        recipe.ingredients.some((ing) => ing.toLowerCase().includes(allergy.toLowerCase())),
      );
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
      await addDoc(collection(db, 'planner'), {
        date,
        mealType,
        type: 'recipe',
        recipeId,
      });
      setIsPlanning(false);
      alert('Добавлено в календарь');
    } catch (error) {
      console.error('Error adding to planner:', error);
      alert('Ошибка при добавлении в календарь');
    }
  };

  const handleAddProductToRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productFormData.name) return;

    const ingredientStr = `${productFormData.name}${productFormData.amount ? ` (${productFormData.amount})` : ''}`;
    const currentIngredients = formData.ingredients
      ? formData.ingredients + '\n' + ingredientStr
      : ingredientStr;

    setFormData({
      ...formData,
      ingredients: currentIngredients,
      calories: formData.calories + (productFormData.calories || 0),
      proteins: formData.proteins + (productFormData.proteins || 0),
      fats: formData.fats + (productFormData.fats || 0),
      carbs: formData.carbs + (productFormData.carbs || 0),
    });

    setIsAddingProductToRecipe(false);
    setProductFormData({ name: '', amount: '', calories: 0, proteins: 0, fats: 0, carbs: 0 });
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  const hasActiveFilters =
    filterCategories.length > 0 ||
    filterAuthors.length > 0 ||
    filterPrograms.length > 0 ||
    filterMaxTime < 120 ||
    filterMaxCalories < 1000;

  // Empty state — no recipes at all
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="mb-8">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">
            Твой банк рецептов пока пуст
          </h2>
          <p className="text-zinc-500">Добавь первый рецепт удобным способом:</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ActionButton
            icon={<Camera className="w-5 h-5" />}
            label="Фото рецепта"
            onClick={() => photoInputRef.current?.click()}
          />
          <ActionButton
            icon={<FileText className="w-5 h-5" />}
            label="PDF документ"
            onClick={() => setIsAddingPDF(true)}
          />
          <ActionButton
            icon={<LinkIcon className="w-5 h-5" />}
            label="Вставить ссылку"
            onClick={() => setIsAddingLink(true)}
          />
          <ActionButton
            icon={<Edit3 className="w-5 h-5" />}
            label="Добавить вручную"
            onClick={() => setIsAddingManual(true)}
          />
        </div>
      </motion.div>
    </div>
  );

  return (
    <>
      {/* ── Toolbar (sticky below global header) ── */}
      <div className="sticky top-16 z-30 bg-white border-b border-zinc-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Поиск рецептов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
              />
            </div>

            {/* View Filter */}
            <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
              <button
                onClick={() => setRecipeView('all')}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
                  recipeView === 'all' ? 'bg-white shadow-sm text-emerald-600' : 'text-zinc-500',
                )}
              >
                Все
              </button>
              <button
                onClick={() => setRecipeView('favorites')}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
                  recipeView === 'favorites'
                    ? 'bg-white shadow-sm text-emerald-600'
                    : 'text-zinc-500',
                )}
              >
                Избранное
              </button>
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold border text-sm',
                  isFilterOpen || hasActiveFilters
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                )}
              >
                <Filter className="w-4 h-4" />
                <span>Фильтр</span>
                {hasActiveFilters && <span className="w-2 h-2 bg-emerald-500 rounded-full" />}
              </button>

              <AnimatePresence>
                {isFilterOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setIsFilterOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-zinc-100 p-5 z-40 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar"
                    >
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                          Сортировка
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              ['newest', 'Сначала новые'],
                              ['oldest', 'Сначала старые'],
                              ['time', 'По времени'],
                              ['calories', 'По калориям'],
                            ] as const
                          ).map(([val, label]) => (
                            <button
                              key={val}
                              onClick={() => setFilterSortBy(val)}
                              className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all border',
                                filterSortBy === val
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-emerald-200',
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            Категория
                          </label>
                          <button
                            onClick={onOpenSettings}
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Категория
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {availableCategories.map((cat) => (
                            <button
                              key={cat}
                              onClick={() => toggleFilterCategory(cat)}
                              className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all border',
                                filterCategories.includes(cat)
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-emerald-200',
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                          Авторы
                        </label>
                        <select
                          className="w-full p-2.5 rounded-xl border border-zinc-200 text-sm font-bold bg-zinc-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={filterAuthors[0] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFilterAuthors(val ? [val] : []);
                          }}
                        >
                          <option value="">Все авторы</option>
                          {allAuthors.map((author) => (
                            <option key={author} value={author}>
                              {author}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                          Программы
                        </label>
                        <select
                          className="w-full p-2.5 rounded-xl border border-zinc-200 text-sm font-bold bg-zinc-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={filterPrograms[0] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFilterPrograms(val ? [val] : []);
                          }}
                        >
                          <option value="">Все программы</option>
                          {allPrograms.map((prog) => (
                            <option key={prog} value={prog}>
                              {prog}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            Время
                          </label>
                          <span className="text-xs font-bold text-emerald-600">
                            {filterMaxTime} мин
                          </span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="120"
                          step="5"
                          value={filterMaxTime}
                          onChange={(e) => setFilterMaxTime(parseInt(e.target.value))}
                          className="w-full accent-emerald-600"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            Калории
                          </label>
                          <span className="text-xs font-bold text-emerald-600">
                            {filterMaxCalories}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="100"
                          max="1000"
                          step="50"
                          value={filterMaxCalories}
                          onChange={(e) => setFilterMaxCalories(parseInt(e.target.value))}
                          className="w-full accent-emerald-600"
                        />
                      </div>

                      <button
                        onClick={() => {
                          setFilterCategories([]);
                          setFilterAuthors([]);
                          setFilterPrograms([]);
                          setFilterMaxTime(120);
                          setFilterMaxCalories(1000);
                        }}
                        className="w-full py-2 text-xs font-bold text-zinc-400 hover:text-red-500 transition-colors border-t border-zinc-50 pt-4"
                      >
                        Сбросить всё
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Add Recipe Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsAddRecipeDropdownOpen(!isAddRecipeDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить рецепт</span>
              </button>

              <AnimatePresence>
                {isAddRecipeDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsAddRecipeDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                    >
                      <AddRecipeOption
                        icon={<Camera className="w-4 h-4 text-emerald-500" />}
                        label="Загрузить фото"
                        onClick={() => {
                          photoInputRef.current?.click();
                          setIsAddRecipeDropdownOpen(false);
                        }}
                      />
                      <AddRecipeOption
                        icon={<FileText className="w-4 h-4 text-emerald-500" />}
                        label="PDF документ"
                        onClick={() => {
                          setIsAddingPDF(true);
                          setIsAddRecipeDropdownOpen(false);
                        }}
                      />
                      <AddRecipeOption
                        icon={<LinkIcon className="w-4 h-4 text-emerald-500" />}
                        label="Вставить ссылку"
                        onClick={() => {
                          setIsAddingLink(true);
                          setIsAddRecipeDropdownOpen(false);
                        }}
                      />
                      <AddRecipeOption
                        icon={<Edit3 className="w-4 h-4 text-emerald-500" />}
                        label="Добавить вручную"
                        onClick={() => {
                          setIsAddingManual(true);
                          setIsAddRecipeDropdownOpen(false);
                        }}
                      />
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="max-w-7xl mx-auto px-4 py-8 pb-32">
        {recipes.length === 0 ? (
          renderEmptyState()
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar for Desktop */}
            <aside className="hidden lg:block w-64 flex-shrink-0 space-y-8 sticky top-36 max-h-[calc(100vh-160px)] overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-4">
                  Библиотека
                </h3>
                <SidebarItem
                  active={recipeView === 'all'}
                  onClick={() => setRecipeView('all')}
                  icon={<BookOpen className="w-5 h-5" />}
                  label="Все рецепты"
                  count={recipes.length}
                />
                <SidebarItem
                  active={recipeView === 'favorites'}
                  onClick={() => setRecipeView('favorites')}
                  icon={<Activity className="w-5 h-5" />}
                  label="Избранное"
                  count={recipes.filter((r) => r.isFavorite).length}
                />
              </div>

              <div className="space-y-4 px-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Категории
                  </h3>
                  <button
                    onClick={onOpenSettings}
                    className="p-1 hover:bg-zinc-100 rounded-md text-emerald-600 transition-colors"
                    title="Добавить категорию"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => toggleFilterCategory(cat)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-2',
                        filterCategories.includes(cat)
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-emerald-200',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Авторы
                  </label>
                  <select
                    className="w-full p-2 rounded-xl border border-zinc-200 text-xs font-bold bg-zinc-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={filterAuthors[0] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFilterAuthors(val ? [val] : []);
                    }}
                  >
                    <option value="">Все авторы</option>
                    {allAuthors.map((author) => (
                      <option key={author} value={author}>
                        {author}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Программы
                  </label>
                  <select
                    className="w-full p-2 rounded-xl border border-zinc-200 text-xs font-bold bg-zinc-50 focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={filterPrograms[0] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFilterPrograms(val ? [val] : []);
                    }}
                  >
                    <option value="">Все программы</option>
                    {allPrograms.map((prog) => (
                      <option key={prog} value={prog}>
                        {prog}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-zinc-600">
                      Время (до {filterMaxTime} мин)
                    </label>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="120"
                    step="5"
                    value={filterMaxTime}
                    onChange={(e) => setFilterMaxTime(parseInt(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-zinc-600">
                      Калории (до {filterMaxCalories})
                    </label>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="1000"
                    step="50"
                    value={filterMaxCalories}
                    onChange={(e) => setFilterMaxCalories(parseInt(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>
              </div>
            </aside>

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
                      setSearchQuery('');
                      setFilterCategories([]);
                      setFilterAuthors([]);
                      setFilterPrograms([]);
                      setFilterMaxTime(120);
                      setFilterMaxCalories(1000);
                    }}
                    className="text-emerald-600 font-bold hover:underline"
                  >
                    Сбросить фильтры
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {filteredRecipes.map((recipe) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={recipe.id}
                      onClick={() => {
                        if (isRecipeSelectionMode) {
                          onSelectedRecipeIdsChange(
                            selectedRecipeIds.includes(recipe.id)
                              ? selectedRecipeIds.filter((id) => id !== recipe.id)
                              : [...selectedRecipeIds, recipe.id],
                          );
                        } else {
                          const allergens = userProfile.allergies.filter((allergy) =>
                            recipe.ingredients.some((ing) =>
                              ing.toLowerCase().includes(allergy.toLowerCase()),
                            ),
                          );
                          if (allergens.length > 0) {
                            alert(
                              `ВНИМАНИЕ! Этот рецепт содержит ваши аллергены: ${allergens.join(', ')}`,
                            );
                          }
                          setSelectedRecipe(recipe);
                        }
                      }}
                      className={cn(
                        'bg-white rounded-2xl border overflow-hidden hover:shadow-xl transition-all group cursor-pointer flex flex-col h-full relative',
                        isRecipeSelectionMode && selectedRecipeIds.includes(recipe.id)
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'border-zinc-200',
                      )}
                      draggable={!isRecipeSelectionMode}
                      onDragStart={(e: any) => {
                        e.dataTransfer.setData('recipeId', recipe.id);
                        e.dataTransfer.setData('sourceSubfolderId', 'main');
                      }}
                    >
                      {userProfile.allergies.some((allergy) =>
                        recipe.ingredients.some((ing) =>
                          ing.toLowerCase().includes(allergy.toLowerCase()),
                        ),
                      ) && (
                        <div
                          className="absolute top-3 right-3 z-10 bg-red-500 text-white p-1.5 rounded-lg shadow-lg"
                          title="Содержит аллергены!"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      )}
                      {isRecipeSelectionMode && (
                        <div className="absolute top-3 left-3 z-20">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all',
                              selectedRecipeIds.includes(recipe.id)
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'bg-white/80 border-zinc-300 text-transparent',
                            )}
                          >
                            <Check className="w-4 h-4" />
                          </div>
                        </div>
                      )}
                      <div className="aspect-[4/3] bg-zinc-100 relative overflow-hidden">
                        <img
                          src={
                            recipe.image ||
                            `https://picsum.photos/seed/${recipe.id}/600/450`
                          }
                          alt={recipe.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 right-3 flex gap-2">
                          <button
                            onClick={(e) => toggleFavorite(recipe.id, e)}
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all',
                              recipe.isFavorite
                                ? 'bg-red-500 text-white'
                                : 'bg-white/80 text-zinc-400 hover:text-red-500',
                            )}
                          >
                            <Activity
                              className={cn('w-4 h-4', recipe.isFavorite && 'fill-current')}
                            />
                          </button>
                        </div>
                        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-2">
                          <div className="flex flex-col items-center leading-none">
                            <span className="text-[10px] opacity-70">Ккал</span>
                            <div className="flex items-center gap-1">
                              <span>{recipe.macros.calories}</span>
                              {userProfile.allergies.some((allergy) =>
                                recipe.ingredients.some((ing) =>
                                  ing.toLowerCase().includes(allergy.toLowerCase()),
                                ),
                              ) && (
                                <span className="text-red-500 font-black text-xs">!</span>
                              )}
                            </div>
                          </div>
                          <div className="w-px h-4 bg-white/20" />
                          <div className="flex flex-col items-center leading-none">
                            <span className="text-[10px] opacity-70">Б</span>
                            <span>{recipe.macros.proteins}</span>
                          </div>
                          <div className="w-px h-4 bg-white/20" />
                          <div className="flex flex-col items-center leading-none">
                            <span className="text-[10px] opacity-70">Ж</span>
                            <span>{recipe.macros.fats}</span>
                          </div>
                          <div className="w-px h-4 bg-white/20" />
                          <div className="flex flex-col items-center leading-none">
                            <span className="text-[10px] opacity-70">У</span>
                            <span>{recipe.macros.carbs}</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex flex-wrap gap-1 mb-3">
                          {recipe.categories.slice(0, 3).map((cat) => (
                            <span
                              key={cat}
                              className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                        <h3 className="font-bold text-lg mb-4 group-hover:text-emerald-600 transition-colors line-clamp-2 leading-snug flex items-center justify-between gap-2">
                          {recipe.title}
                          {userProfile.allergies.some((allergy) =>
                            recipe.ingredients.some((ing) =>
                              ing.toLowerCase().includes(allergy.toLowerCase()),
                            ),
                          ) && (
                            <span title="Содержит аллергены!">
                              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            </span>
                          )}
                        </h3>
                        <div className="mt-auto pt-4 border-t border-zinc-100 flex items-center justify-between text-zinc-500 text-sm">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-emerald-500" />
                            <span className="font-medium">{recipe.time}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-emerald-500" />
                            <span className="font-medium">{recipe.servings} порц.</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Hidden photo input (ref owned by App, renders here so onChange lives in RecipesView) ── */}
      <input
        type="file"
        ref={photoInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) {
            const imagePromises = files.map(
              (file) =>
                new Promise<{ base64: string; mimeType: string }>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    resolve({ base64: reader.result as string, mimeType: file.type });
                  };
                  reader.readAsDataURL(file);
                }),
            );
            const images = await Promise.all(imagePromises);
            await analyzePhoto(images, true);
          }
          // reset so the same file can be selected again
          e.target.value = '';
        }}
      />

      {/* ── Modals ── */}
      <AnimatePresence>
        {isScanning && !isAddingManual && !isAddingPDF && !isAddingLink && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center gap-4"
          >
            <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
            <div className="text-center">
              <h3 className="text-xl font-bold text-zinc-900">Анализирую рецепт...</h3>
              <p className="text-zinc-500">Это займет всего несколько секунд</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Точно удалить?</h3>
              <p className="text-zinc-500 text-sm mb-8">
                Это действие нельзя будет отменить. Рецепт будет удален навсегда.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Отмена
                </button>
                <button
                  onClick={async () => {
                    if (selectedRecipe) {
                      try {
                        await deleteDoc(doc(db, 'recipes', selectedRecipe.id));
                        setSelectedRecipe(null);
                        setIsDeleteConfirmOpen(false);
                      } catch (error) {
                        console.error('Error deleting recipe:', error);
                        alert('Ошибка при удалении рецепта');
                      }
                    }
                  }}
                  className="py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Add Modal (for Recipe) */}
      <AnimatePresence>
        {isAddingProductToRecipe && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingProductToRecipe(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Добавить продукт в рецепт</h3>
                <button
                  onClick={() => setIsAddingProductToRecipe(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddProductToRecipe} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1">
                      Название продукта *
                    </label>
                    <input
                      required
                      type="text"
                      value={productFormData.name}
                      onChange={(e) =>
                        setProductFormData({ ...productFormData, name: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Например: Яблоко"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-1">
                      Количество
                    </label>
                    <input
                      type="text"
                      value={productFormData.amount}
                      onChange={(e) =>
                        setProductFormData({ ...productFormData, amount: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Например: 1 шт или 200г"
                    />
                  </div>

                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 grid grid-cols-2 gap-4">
                    {(
                      [
                        ['calories', 'Ккал'],
                        ['proteins', 'Белки (г)'],
                        ['fats', 'Жиры (г)'],
                        ['carbs', 'Углеводы (г)'],
                      ] as const
                    ).map(([field, label]) => (
                      <div key={field}>
                        <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">
                          {label}
                        </label>
                        <input
                          type="number"
                          value={productFormData[field]}
                          onChange={(e) =>
                            setProductFormData({
                              ...productFormData,
                              [field]: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Добавить в рецепт и рассчитать КБЖУ
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PDF Add Modal */}
      <AnimatePresence>
        {isAddingPDF && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isScanning && setIsAddingPDF(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
            >
              {isScanning && (
                <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                  <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                  <p className="text-sm font-bold text-zinc-900">Анализирую PDF...</p>
                </div>
              )}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">PDF документ</h3>
                <button
                  onClick={() => setIsAddingPDF(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="py-12 space-y-4">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10" />
                </div>
                <p className="text-zinc-600">
                  Загрузите PDF файл с рецептом для автоматического анализа.
                </p>
                <label className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 cursor-pointer block">
                  Выбрать файл
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setIsScanning(true);
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const base64 = (reader.result as string).split(',')[1] ?? '';
                          try {
                            const result = await aiClient.importFromPdf({
                              pdfBase64: base64,
                              availableCategories,
                            });

                            for (const r of result.recipes) {
                              let dishImage: string | null = null;

                              if (r.pageNumber && r.dishBoundingBox) {
                                const extracted = await extractImageFromPDF(
                                  base64,
                                  r.pageNumber,
                                  r.dishBoundingBox,
                                );
                                if (extracted) dishImage = extracted;
                              }

                              if (!dishImage) {
                                const generated = await aiClient.generateImage({
                                  title: r.title,
                                  ingredients: r.ingredients,
                                });
                                if (generated?.imageDataUri) dishImage = generated.imageDataUri;
                              }

                              // Firestore limit ~1MB per doc; base64 images can exceed it.
                              const imageToStore =
                                dishImage && dishImage.length <= 800_000 ? dishImage : null;
                              const docRef = await addDoc(collection(db, 'recipes'), {
                                title: r.title,
                                author: r.author ?? '',
                                image: imageToStore,
                                time: r.time,
                                servings: r.servings,
                                categories: r.categories,
                                ingredients: r.ingredients,
                                steps: r.steps,
                                macros: r.macros,
                                isFavorite: false,
                                createdAt: new Date().toISOString(),
                              });

                              if (recipeTarget) {
                                await addRecipeToTarget(docRef.id);
                              }
                            }

                            setIsAddingPDF(false);
                            alert(`Успешно добавлено рецептов: ${result.recipes.length}`);
                          } catch (error) {
                            console.error('Error analyzing PDF:', error);
                            alert('Не удалось распознать PDF. Попробуйте другой файл.');
                          } finally {
                            setIsScanning(false);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Link Add Modal */}
      <AnimatePresence>
        {isAddingLink && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isScanning && setIsAddingLink(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Импорт по ссылке</h3>
                <button
                  onClick={() => setIsAddingLink(false)}
                  disabled={isScanning}
                  className="text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleLinkSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700 font-bold">
                    URL адрес рецепта
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input
                      required
                      type="url"
                      value={recipeLink}
                      onChange={(e) => setRecipeLink(e.target.value)}
                      disabled={isScanning}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm disabled:opacity-50"
                      placeholder="https://example.com/recipe or youtube.com/..."
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider">
                    Поддерживаются ссылки на сайты и видео
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isScanning || !recipeLink.trim()}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Сканирую...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>Добавить рецепт</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Add / Edit Modal */}
      <AnimatePresence>
        {isAddingManual && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingManual(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {isScanning && (
                <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-zinc-900">Анализирую фото...</p>
                    <p className="text-sm text-zinc-500">Наш ИИ считывает ингредиенты и шаги</p>
                  </div>
                </div>
              )}
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  {editingId ? 'Редактировать рецепт' : 'Новый рецепт'}
                </h3>
                <button
                  onClick={() => {
                    setIsAddingManual(false);
                    setEditingId(null);
                  }}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddManual} className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold">
                    Название блюда *
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-lg font-medium"
                    placeholder="Например: Паста Карбонара"
                  />
                </div>

                {/* Source Link */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold">
                    Ссылка на источник
                  </label>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="url"
                      value={formData.sourceUrl}
                      onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Photo Upload */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-zinc-700 font-bold">
                      Фотография блюда
                    </label>
                    {formData.image && !isScanning && (
                      <button
                        type="button"
                        onClick={() =>
                          analyzePhoto(
                            [{ base64: formData.image!, mimeType: 'image/jpeg' }],
                            false,
                          )
                        }
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                      >
                        <Activity className="w-3 h-3" />
                        Распознать текст ИИ
                      </button>
                    )}
                  </div>
                  <label className="w-full aspect-video bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-3xl flex flex-col items-center justify-center gap-3 group hover:border-emerald-300 hover:bg-emerald-50/30 transition-all cursor-pointer overflow-hidden relative">
                    {formData.image ? (
                      <img
                        src={formData.image}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-zinc-400 group-hover:text-emerald-600 group-hover:scale-110 transition-all">
                          <Camera className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-zinc-500 group-hover:text-emerald-700">
                            Нажмите для загрузки
                          </p>
                          <p className="text-[10px] text-zinc-400 uppercase tracking-wider mt-1">
                            JPG, PNG до 5MB
                          </p>
                        </div>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData({ ...formData, image: reader.result as string });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Ingredients */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-zinc-700 font-bold">
                      Ингредиенты
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!formData.ingredients.trim()) {
                            alert('Сначала введите ингредиенты');
                            return;
                          }
                          setIsScanning(true);
                          try {
                            const data = await aiClient.calculateKbzhu({
                              ingredients: formData.ingredients,
                            });
                            setFormData({
                              ...formData,
                              calories: data.calories || 0,
                              proteins: data.proteins || 0,
                              fats: data.fats || 0,
                              carbs: data.carbs || 0,
                            });
                          } catch (e) {
                            console.error(e);
                            alert('Не удалось рассчитать КБЖУ. Проверьте ингредиенты.');
                          } finally {
                            setIsScanning(false);
                          }
                        }}
                        className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-lg transition-colors uppercase tracking-wider"
                      >
                        <Activity className="w-3 h-3" />
                        Рассчитать КБЖУ ИИ
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingProductToRecipe(true)}
                        className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg transition-colors uppercase tracking-wider"
                      >
                        <Plus className="w-3 h-3" />
                        Добавить продукт с КБЖУ
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={5}
                    placeholder="100г пасты&#10;2 яйца&#10;50г бекона..."
                    value={formData.ingredients}
                    onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
                  />
                </div>

                {/* Steps */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2 font-bold">
                    Пошаговое приготовление (описание)
                  </label>
                  <textarea
                    rows={6}
                    placeholder="1. Отварите пасту...&#10;2. Обжарьте бекон..."
                    value={formData.steps}
                    onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
                  />
                </div>

                {/* Macros */}
                <div className="p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100/50">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-bold text-emerald-900 uppercase tracking-wider">
                      КБЖУ (на порцию)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, calories: 0, proteins: 0, fats: 0, carbs: 0 })
                      }
                      className="text-[10px] font-bold text-zinc-400 hover:text-red-500 uppercase tracking-wider transition-colors"
                    >
                      Сбросить
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {(
                      [
                        ['calories', 'Ккал'],
                        ['proteins', 'Белки (г)'],
                        ['fats', 'Жиры (г)'],
                        ['carbs', 'Углеводы (г)'],
                      ] as const
                    ).map(([field, label]) => (
                      <div key={field}>
                        <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">
                          {label}
                        </label>
                        <input
                          type="number"
                          value={formData[field]}
                          onChange={(e) =>
                            setFormData({ ...formData, [field]: parseInt(e.target.value) })
                          }
                          className="w-full px-4 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Categories, Time, Servings, Substitutions */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-3 font-bold">
                      Категории
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            if (formData.categories.includes(cat)) {
                              setFormData({
                                ...formData,
                                categories: formData.categories.filter((c) => c !== cat),
                              });
                            } else {
                              setFormData({
                                ...formData,
                                categories: [...formData.categories, cat],
                              });
                            }
                          }}
                          className={cn(
                            'px-4 py-2 rounded-2xl text-xs font-bold transition-all border',
                            formData.categories.includes(cat)
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100'
                              : 'bg-white border-zinc-200 text-zinc-500 hover:border-emerald-300 hover:text-emerald-600',
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold">
                        Время приготовления
                      </label>
                      <input
                        type="text"
                        placeholder="30 мин"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold">
                        Порции
                      </label>
                      <input
                        type="number"
                        value={formData.servings}
                        onChange={(e) =>
                          setFormData({ ...formData, servings: parseInt(e.target.value) })
                        }
                        className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold">
                      Замена ингредиентов / Советы
                    </label>
                    <textarea
                      rows={3}
                      value={formData.substitutions}
                      onChange={(e) =>
                        setFormData({ ...formData, substitutions: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>
                </div>

                {/* Author */}
                <div className="pt-4 border-t border-zinc-100">
                  <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold">
                    Автор / Создатель
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="pt-6 flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingManual(false);
                      setEditingId(null);
                    }}
                    className="flex-1 px-4 py-4 border border-zinc-200 rounded-2xl font-bold hover:bg-zinc-50 transition-colors text-zinc-600"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-xl shadow-emerald-100"
                  >
                    Сохранить рецепт
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                                await updateDoc(doc(db, 'recipes', selectedRecipe.id), {
                                  image: base64,
                                });
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
                    <button className="flex flex-col items-center justify-center p-3 sm:p-4 bg-white border border-zinc-100 rounded-2xl text-zinc-600 hover:bg-zinc-50 transition-all gap-2">
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
                                      ? program.recipeIds.filter(
                                          (id) => id !== selectedRecipe.id,
                                        )
                                      : [...program.recipeIds, selectedRecipe.id];
                                    try {
                                      await updateDoc(doc(db, 'programs', program.id), {
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
                          <h4 className="font-bold text-emerald-900">
                            Добавить в план питания
                          </h4>
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
                          КБЖУ (на порцию)
                        </p>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                          <div>
                            <p className="text-xs text-emerald-800/60 mb-0.5">Калории</p>
                            <p className="font-bold text-lg text-emerald-900">
                              {selectedRecipe.macros.calories} ккал
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-emerald-800/60 mb-0.5">Белки</p>
                            <p className="font-bold text-lg text-emerald-900">
                              {selectedRecipe.macros.proteins}г
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-emerald-800/60 mb-0.5">Жиры</p>
                            <p className="font-bold text-lg text-emerald-900">
                              {selectedRecipe.macros.fats}г
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-emerald-800/60 mb-0.5">Углеводы</p>
                            <p className="font-bold text-lg text-emerald-900">
                              {selectedRecipe.macros.carbs}г
                            </p>
                          </div>
                        </div>
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
                            Масштабирование порций
                          </p>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecipe({
                                  ...selectedRecipe,
                                  servings: Math.max(1, selectedRecipe.servings - 1),
                                });
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-white border border-zinc-200 rounded-lg text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                            >
                              -
                            </button>
                            <p className="font-bold text-zinc-700 min-w-[20px] text-center">
                              {selectedRecipe.servings}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecipe({
                                  ...selectedRecipe,
                                  servings: selectedRecipe.servings + 1,
                                });
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-white border border-zinc-200 rounded-lg text-zinc-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                            >
                              +
                            </button>
                          </div>
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
