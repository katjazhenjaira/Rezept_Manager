import React from 'react';
import { Calendar, Users, Activity, Check, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { recipeAllergens, recipeHasAllergens } from '@/shared/domain/allergies';
import type { Recipe, UserProfile } from '@/shared/domain/types';

// ─── Utility ─────────────────────────────────────────────────────────────────

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type RecipeCardProps = {
  recipe: Recipe;
  userProfile: UserProfile;
  isRecipeSelectionMode: boolean;
  selectedRecipeIds: string[];
  onSelectedRecipeIdsChange: (ids: string[]) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onToggleFavorite: (id: string, e?: React.MouseEvent) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

// React.memo — грид рецептов не должен перерендериваться при несвязанных
// изменениях state родителя (например, набор текста в форме добавления рецепта),
// пока пропы конкретной карточки не изменились (PERF-5).
export const RecipeCard = React.memo(function RecipeCard({
  recipe,
  userProfile,
  isRecipeSelectionMode,
  selectedRecipeIds,
  onSelectedRecipeIdsChange,
  onSelectRecipe,
  onToggleFavorite,
}: RecipeCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => {
        if (isRecipeSelectionMode) {
          onSelectedRecipeIdsChange(
            selectedRecipeIds.includes(recipe.id)
              ? selectedRecipeIds.filter((id) => id !== recipe.id)
              : [...selectedRecipeIds, recipe.id],
          );
        } else {
          const allergens = recipeAllergens(recipe, userProfile.allergies);
          if (allergens.length > 0) {
            alert(`ВНИМАНИЕ! Этот рецепт содержит ваши аллергены: ${allergens.join(', ')}`);
          }
          onSelectRecipe(recipe);
        }
      }}
      className={cn(
        'bg-white rounded-2xl border overflow-hidden hover:shadow-xl transition-all group cursor-pointer flex flex-col h-full relative',
        isRecipeSelectionMode && selectedRecipeIds.includes(recipe.id)
          ? 'border-emerald-500 ring-2 ring-emerald-500/20'
          : 'border-zinc-200',
      )}
      draggable={!isRecipeSelectionMode}
      // motion.div типизирует onDragStart под свой pan-жест (event: MouseEvent | TouchEvent | PointerEvent),
      // но при draggable=true framer-motion форвардит его как нативный DOM-листенер — приводим к реальному типу.
      onDragStart={(e) => {
        const dragEvent = e as unknown as React.DragEvent<HTMLDivElement>;
        dragEvent.dataTransfer.setData('recipeId', recipe.id);
        dragEvent.dataTransfer.setData('sourceSubfolderId', 'main');
      }}
    >
      {recipeHasAllergens(recipe, userProfile.allergies) && (
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
          src={recipe.image || `https://picsum.photos/seed/${recipe.id}/600/450`}
          alt={recipe.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            type="button"
            aria-label={recipe.isFavorite ? 'Убрать из избранного' : 'В избранное'}
            // Гасим всплытие сами, а не полагаемся на onToggleFavorite: клик по «избранному»
            // не должен открывать карточку (onClick родительского motion.div).
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(recipe.id, e);
            }}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all',
              recipe.isFavorite
                ? 'bg-red-500 text-white'
                : 'bg-white/80 text-zinc-400 hover:text-red-500',
            )}
          >
            <Activity className={cn('w-4 h-4', recipe.isFavorite && 'fill-current')} />
          </button>
        </div>
        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-2">
          <div className="flex flex-col items-center leading-none">
            <span className="text-[10px] opacity-70">Ккал</span>
            <div className="flex items-center gap-1">
              <span>{recipe.macros.calories}</span>
              {recipeHasAllergens(recipe, userProfile.allergies) && (
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
          {recipeHasAllergens(recipe, userProfile.allergies) && (
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
  );
});
