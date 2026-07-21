import React from 'react';
import { BookOpen, Activity, Plus } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Recipe, RecipeView } from '@/shared/domain/types';

// ─── Utility ─────────────────────────────────────────────────────────────────

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

export type RecipeFilterSidebarProps = {
  recipes: Recipe[];
  recipeView: RecipeView;
  onRecipeViewChange: (v: RecipeView) => void;
  onOpenSettings: () => void;
  availableCategories: string[];
  filterCategories: string[];
  onToggleFilterCategory: (cat: string) => void;
  filterAuthors: string[];
  onFilterAuthorsChange: (v: string[]) => void;
  allAuthors: string[];
  filterPrograms: string[];
  onFilterProgramsChange: (v: string[]) => void;
  allPrograms: string[];
  filterMaxTime: number;
  onFilterMaxTimeChange: (v: number) => void;
  filterMaxCalories: number;
  onFilterMaxCaloriesChange: (v: number) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RecipeFilterSidebar({
  recipes,
  recipeView,
  onRecipeViewChange,
  onOpenSettings,
  availableCategories,
  filterCategories,
  onToggleFilterCategory,
  filterAuthors,
  onFilterAuthorsChange,
  allAuthors,
  filterPrograms,
  onFilterProgramsChange,
  allPrograms,
  filterMaxTime,
  onFilterMaxTimeChange,
  filterMaxCalories,
  onFilterMaxCaloriesChange,
}: RecipeFilterSidebarProps) {
  return (
    <aside className="hidden lg:block w-64 flex-shrink-0 space-y-8 sticky top-36 max-h-[calc(100vh-160px)] overflow-y-auto pr-2 custom-scrollbar">
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-4">
          Библиотека
        </h3>
        <SidebarItem
          active={recipeView === 'all'}
          onClick={() => onRecipeViewChange('all')}
          icon={<BookOpen className="w-5 h-5" />}
          label="Все рецепты"
          count={recipes.length}
        />
        <SidebarItem
          active={recipeView === 'favorites'}
          onClick={() => onRecipeViewChange('favorites')}
          icon={<Activity className="w-5 h-5" />}
          label="Избранное"
          count={recipes.filter((r) => r.isFavorite).length}
        />
      </div>

      <div className="space-y-4 px-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Категории</h3>
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
              onClick={() => onToggleFilterCategory(cat)}
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
              onFilterAuthorsChange(val ? [val] : []);
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
              onFilterProgramsChange(val ? [val] : []);
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
            onChange={(e) => onFilterMaxTimeChange(parseInt(e.target.value))}
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
            onChange={(e) => onFilterMaxCaloriesChange(parseInt(e.target.value))}
            className="w-full accent-emerald-600"
          />
        </div>
      </div>
    </aside>
  );
}
