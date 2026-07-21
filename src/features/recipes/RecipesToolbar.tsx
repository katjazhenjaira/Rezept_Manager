import React, { useState } from 'react';
import { Plus, Camera, FileText, Link as LinkIcon, Edit3, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { RecipeView } from '@/shared/domain/types';

// ─── Utility ─────────────────────────────────────────────────────────────────

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

// ─── Props ────────────────────────────────────────────────────────────────────

export type RecipesToolbarProps = {
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  recipeView: RecipeView;
  onRecipeViewChange: (v: RecipeView) => void;
  hasActiveFilters: boolean;
  filterSortBy: 'newest' | 'oldest' | 'time' | 'calories';
  onFilterSortByChange: (v: 'newest' | 'oldest' | 'time' | 'calories') => void;
  availableCategories: string[];
  onOpenSettings: () => void;
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
  onResetFilters: () => void;
  // Cross-tab: photo import ref (Programs tab can also trigger click)
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  onAddPDF: () => void;
  onAddLink: () => void;
  onAddManual: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RecipesToolbar({
  searchQuery,
  onSearchQueryChange,
  recipeView,
  onRecipeViewChange,
  hasActiveFilters,
  filterSortBy,
  onFilterSortByChange,
  availableCategories,
  onOpenSettings,
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
  onResetFilters,
  photoInputRef,
  onAddPDF,
  onAddLink,
  onAddManual,
}: RecipesToolbarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAddRecipeDropdownOpen, setIsAddRecipeDropdownOpen] = useState(false);

  return (
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
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-100 border border-zinc-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
            />
          </div>

          {/* View Filter */}
          <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button
              onClick={() => onRecipeViewChange('all')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
                recipeView === 'all' ? 'bg-white shadow-sm text-emerald-600' : 'text-zinc-500',
              )}
            >
              Все
            </button>
            <button
              onClick={() => onRecipeViewChange('favorites')}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
                recipeView === 'favorites' ? 'bg-white shadow-sm text-emerald-600' : 'text-zinc-500',
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
                  <div className="fixed inset-0 z-30" onClick={() => setIsFilterOpen(false)} />
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
                            onClick={() => onFilterSortByChange(val)}
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
                            onClick={() => onToggleFilterCategory(cat)}
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
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        Программы
                      </label>
                      <select
                        className="w-full p-2.5 rounded-xl border border-zinc-200 text-sm font-bold bg-zinc-50 focus:ring-2 focus:ring-emerald-500 outline-none"
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
                        onChange={(e) => onFilterMaxTimeChange(parseInt(e.target.value))}
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
                        onChange={(e) => onFilterMaxCaloriesChange(parseInt(e.target.value))}
                        className="w-full accent-emerald-600"
                      />
                    </div>

                    <button
                      onClick={onResetFilters}
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
                        onAddPDF();
                        setIsAddRecipeDropdownOpen(false);
                      }}
                    />
                    <AddRecipeOption
                      icon={<LinkIcon className="w-4 h-4 text-emerald-500" />}
                      label="Вставить ссылку"
                      onClick={() => {
                        onAddLink();
                        setIsAddRecipeDropdownOpen(false);
                      }}
                    />
                    <AddRecipeOption
                      icon={<Edit3 className="w-4 h-4 text-emerald-500" />}
                      label="Добавить вручную"
                      onClick={() => {
                        onAddManual();
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
  );
}
