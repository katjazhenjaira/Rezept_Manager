import React from 'react';
import {
  Plus,
  Camera,
  FileText,
  Link as LinkIcon,
  Trash2,
  Download,
  Loader2,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useRepositories } from '@/app/providers/RepositoryContext';
import { aiClient } from '@/services/ai/aiClient';
import type { Recipe, Program } from '@/shared/domain/types';
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecipeFormData = {
  title: string;
  author: string;
  sourceUrl: string;
  image: string | null;
  time: string;
  servings: number;
  categories: string[];
  ingredients: string;
  steps: string;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  substitutions: string;
};

export type ProductFormData = {
  name: string;
  amount: string;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
};

// ─── Props ────────────────────────────────────────────────────────────────────

export type AddRecipeModalsProps = {
  recipes: Recipe[];
  programs: Program[];
  availableCategories: string[];
  // Cross-tab: recipe target (when adding recipe from Programs tab context)
  recipeTarget: { programId: string; subfolderId: string | 'main' } | null;
  onRecipeTargetCleared: () => void;
  // Cross-tab: photo import ref (Programs tab can also trigger click)
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  selectedRecipe: Recipe | null;
  onSelectedRecipeChange: (r: Recipe | null) => void;
  isAddingManual: boolean;
  onIsAddingManualChange: (v: boolean) => void;
  isAddingPDF: boolean;
  onIsAddingPDFChange: (v: boolean) => void;
  isAddingLink: boolean;
  onIsAddingLinkChange: (v: boolean) => void;
  isScanning: boolean;
  onIsScanningChange: (v: boolean) => void;
  formData: RecipeFormData;
  onFormDataChange: React.Dispatch<React.SetStateAction<RecipeFormData>>;
  editingId: string | null;
  onEditingIdChange: (id: string | null) => void;
  productFormData: ProductFormData;
  onProductFormDataChange: (d: ProductFormData) => void;
  isAddingProductToRecipe: boolean;
  onIsAddingProductToRecipeChange: (v: boolean) => void;
  recipeLink: string;
  onRecipeLinkChange: (v: string) => void;
  isDeleteConfirmOpen: boolean;
  onIsDeleteConfirmOpenChange: (v: boolean) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AddRecipeModals({
  recipes,
  programs,
  availableCategories,
  recipeTarget,
  onRecipeTargetCleared,
  photoInputRef,
  selectedRecipe,
  onSelectedRecipeChange: setSelectedRecipe,
  isAddingManual,
  onIsAddingManualChange: setIsAddingManual,
  isAddingPDF,
  onIsAddingPDFChange: setIsAddingPDF,
  isAddingLink,
  onIsAddingLinkChange: setIsAddingLink,
  isScanning,
  onIsScanningChange: setIsScanning,
  formData,
  onFormDataChange: setFormData,
  editingId,
  onEditingIdChange: setEditingId,
  productFormData,
  onProductFormDataChange: setProductFormData,
  isAddingProductToRecipe,
  onIsAddingProductToRecipeChange: setIsAddingProductToRecipe,
  recipeLink,
  onRecipeLinkChange: setRecipeLink,
  isDeleteConfirmOpen,
  onIsDeleteConfirmOpenChange: setIsDeleteConfirmOpen,
}: AddRecipeModalsProps) {
  const { recipes: recipesRepo, programs: programsRepo } = useRepositories();

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const addRecipeToTarget = async (recipeId: string) => {
    if (!recipeTarget) return;
    const { programId, subfolderId } = recipeTarget;
    const program = programs.find((p) => p.id === programId);
    if (!program) return;

    if (subfolderId === 'main') {
      await programsRepo.update(programId, { recipeIds: [...program.recipeIds, recipeId] });
    } else {
      const newSubfolders = (program.subfolders ?? []).map((sf) =>
        sf.id === subfolderId ? { ...sf, recipeIds: [...sf.recipeIds, recipeId] } : sf,
      );
      await programsRepo.update(programId, { subfolders: newSubfolders });
    }
    onRecipeTargetCleared();
  };

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    let imageUrl = formData.image;
    if (!imageUrl) {
      try {
        const generated = await aiClient.generateImage({
          title: formData.title,
          ingredients: formData.ingredients.split('\n'),
        });
        if (generated?.imageDataUri) imageUrl = generated.imageDataUri;
      } catch (error) {
        console.error('Error generating recipe image:', error);
      }
    }

    const recipeData = {
      title: formData.title,
      author: formData.author,
      sourceUrl: formData.sourceUrl,
      image: imageUrl ?? undefined,
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
        await recipesRepo.update(editingId, recipeData);
        if (selectedRecipe?.id === editingId) {
          setSelectedRecipe({ id: editingId, ...recipeData } as Recipe);
        }
      } else {
        const id = await recipesRepo.add(recipeData);
        if (recipeTarget) {
          await addRecipeToTarget(id);
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
        const id = await recipesRepo.add(recipeToSave);
        if (recipeTarget) {
          await addRecipeToTarget(id);
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

      const recipeData = {
        title: r.title,
        author: r.author ?? '',
        image: r.dishImage,
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

      const id = await recipesRepo.add(recipeData);
      if (recipeTarget) {
        await addRecipeToTarget(id);
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

  const handlePdfFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
              const extracted = await extractImageFromPDF(base64, r.pageNumber, r.dishBoundingBox);
              if (extracted) dishImage = extracted;
            }

            if (!dishImage) {
              const generated = await aiClient.generateImage({
                title: r.title,
                ingredients: r.ingredients,
              });
              if (generated?.imageDataUri) dishImage = generated.imageDataUri;
            }

            const id = await recipesRepo.add({
              title: r.title,
              author: r.author ?? '',
              image: dishImage ?? undefined,
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
              await addRecipeToTarget(id);
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
  };

  const handleDeleteConfirmed = async () => {
    if (selectedRecipe) {
      try {
        await recipesRepo.delete(selectedRecipe.id);
        setSelectedRecipe(null);
        setIsDeleteConfirmOpen(false);
      } catch (error) {
        console.error('Error deleting recipe:', error);
        alert('Ошибка при удалении рецепта');
      }
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Hidden photo input (ref owned by App, renders here so onChange lives in AddRecipeModals) ── */}
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
                  onClick={handleDeleteConfirmed}
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
                    <label className="block text-sm font-bold text-zinc-700 mb-1">Количество</label>
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
                    onChange={handlePdfFileSelected}
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
                          analyzePhoto([{ base64: formData.image!, mimeType: 'image/jpeg' }], false)
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
                      onChange={(e) => setFormData({ ...formData, substitutions: e.target.value })}
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
    </>
  );
}
