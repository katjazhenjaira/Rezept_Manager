import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  ShoppingCart,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  List,
  ChefHat,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useRepositories } from '@/app/providers/RepositoryContext';
import { isStaple } from '@/features/cart/services/staples';
import {
  format,
  addDays,
  subDays,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isToday,
  parseISO,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { useData } from '@/app/providers/DataContext';
import { recipeAllergens } from '@/shared/domain/allergies';
import { sumMacros } from '@/shared/domain/macros';
import type {
  Recipe,
  UserProfile,
  ActiveNutritionPlan,
  PlannerViewScale,
  PlannerViewMode,
} from '@/shared/domain/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type PlannerViewProps = {
  recipes: Recipe[];
  userProfile: UserProfile;
  activeNutritionPlan: ActiveNutritionPlan | null;
  checkedEntries: string[];
  onCheckedEntriesChange: (entries: string[]) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onNavigateToCart: () => void;
  mealTypes: string[];
  onMealTypesChange: (types: string[]) => void;
};

export function PlannerView({
  recipes,
  userProfile,
  activeNutritionPlan: _activeNutritionPlan,
  checkedEntries: _checkedEntries,
  onCheckedEntriesChange: _onCheckedEntriesChange,
  onSelectRecipe,
  onNavigateToCart,
  mealTypes,
  onMealTypesChange,
}: PlannerViewProps) {
  const { plannerEntries } = useData();
  const { planner: plannerRepo, cart: cartRepo } = useRepositories();

  const [plannerViewScale, setPlannerViewScale] = useState<PlannerViewScale>('week');
  const [plannerViewMode, setPlannerViewMode] = useState<PlannerViewMode>('calendar');
  const [selectedPlannerDate, setSelectedPlannerDate] = useState(new Date());
  const [isRecipePickerOpen, setIsRecipePickerOpen] = useState(false);
  const [pickingMealInfo, setPickingMealInfo] = useState<{ date: string; mealType: string } | null>(
    null,
  );
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [activeAddDropdown, setActiveAddDropdown] = useState<string | null>(null);
  const [productFormData, setProductFormData] = useState({
    name: '',
    amount: '',
    calories: 0,
    proteins: 0,
    fats: 0,
    carbs: 0,
  });

  const handleAddProductToPlanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickingMealInfo || !productFormData.name) return;

    try {
      await plannerRepo.add({
        date: pickingMealInfo.date,
        mealType: pickingMealInfo.mealType,
        type: 'product',
        productName: productFormData.name,
        amount: productFormData.amount,
        macros: {
          calories: productFormData.calories,
          proteins: productFormData.proteins,
          fats: productFormData.fats,
          carbs: productFormData.carbs,
        },
      });
      setIsAddingProduct(false);
      setProductFormData({ name: '', amount: '', calories: 0, proteins: 0, fats: 0, carbs: 0 });
      alert('Продукт добавлен');
    } catch (error) {
      console.error('Error adding product to planner:', error);
      alert('Ошибка при добавлении продукта');
    }
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
    } catch (error) {
      console.error('Error adding to planner:', error);
    }
  };

  const handleRemoveFromPlanner = async (entryId: string) => {
    try {
      await plannerRepo.delete(entryId);
    } catch (error) {
      console.error('Error removing from planner:', error);
    }
  };

  const getEntriesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return plannerEntries.filter((e) => e.date === dateStr);
  };

  const getRecipeById = (id: string | undefined) =>
    id ? recipes.find((r) => r.id === id) : undefined;

  const getMacrosForDate = (date: Date) => {
    const entries = getEntriesForDate(date);
    return sumMacros(entries, recipes);
  };

  const selectedDateMacros = getMacrosForDate(selectedPlannerDate);
  const isSelectedDateOverLimit =
    selectedDateMacros.calories > userProfile.targetCalories ||
    selectedDateMacros.proteins > userProfile.targetProteins ||
    selectedDateMacros.fats > userProfile.targetFats ||
    selectedDateMacros.carbs > userProfile.targetCarbs;

  const renderDayView = () => {
    const entries = getEntriesForDate(selectedPlannerDate);
    const totalMacros = selectedDateMacros;

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-3xl border border-zinc-100 p-5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedPlannerDate(subDays(selectedPlannerDate, 1))}
              className="p-2 hover:bg-zinc-50 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div className="text-center min-w-[140px]">
              <h3 className="font-bold text-lg">
                {format(selectedPlannerDate, 'd MMMM', { locale: ru })}
              </h3>
              <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                {format(selectedPlannerDate, 'EEEE', { locale: ru })}
              </p>
            </div>
            <button
              onClick={() => setSelectedPlannerDate(addDays(selectedPlannerDate, 1))}
              className="p-2 hover:bg-zinc-50 rounded-xl transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          <div className="flex gap-2">
            <div
              className={cn(
                'text-center p-2 rounded-xl min-w-[50px] border transition-colors',
                totalMacros.calories > userProfile.targetCalories
                  ? 'bg-red-50 border-red-100'
                  : 'bg-zinc-50 border-zinc-100',
              )}
            >
              <p className="text-[8px] font-bold text-zinc-400 uppercase">Ккал</p>
              <p
                className={cn(
                  'font-bold text-xs',
                  totalMacros.calories > userProfile.targetCalories
                    ? 'text-red-600'
                    : 'text-emerald-600',
                )}
              >
                {totalMacros.calories}
              </p>
            </div>
            <div
              className={cn(
                'text-center p-2 rounded-xl min-w-[40px] border transition-colors',
                totalMacros.proteins > userProfile.targetProteins
                  ? 'bg-red-50 border-red-100'
                  : 'bg-zinc-50 border-zinc-100',
              )}
            >
              <p className="text-[8px] font-bold text-zinc-400 uppercase">Б</p>
              <p
                className={cn(
                  'font-bold text-xs',
                  totalMacros.proteins > userProfile.targetProteins
                    ? 'text-red-600'
                    : 'text-zinc-700',
                )}
              >
                {totalMacros.proteins}г
              </p>
            </div>
            <div
              className={cn(
                'text-center p-2 rounded-xl min-w-[40px] border transition-colors',
                totalMacros.fats > userProfile.targetFats
                  ? 'bg-red-50 border-red-100'
                  : 'bg-zinc-50 border-zinc-100',
              )}
            >
              <p className="text-[8px] font-bold text-zinc-400 uppercase">Ж</p>
              <p
                className={cn(
                  'font-bold text-xs',
                  totalMacros.fats > userProfile.targetFats ? 'text-red-600' : 'text-zinc-700',
                )}
              >
                {totalMacros.fats}г
              </p>
            </div>
            <div
              className={cn(
                'text-center p-2 rounded-xl min-w-[40px] border transition-colors',
                totalMacros.carbs > userProfile.targetCarbs
                  ? 'bg-red-50 border-red-100'
                  : 'bg-zinc-50 border-zinc-100',
              )}
            >
              <p className="text-[8px] font-bold text-zinc-400 uppercase">У</p>
              <p
                className={cn(
                  'font-bold text-xs',
                  totalMacros.carbs > userProfile.targetCarbs ? 'text-red-600' : 'text-zinc-700',
                )}
              >
                {totalMacros.carbs}г
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {mealTypes.map((meal) => {
            const mealEntries = entries.filter((e) => e.mealType === meal);
            const mealMacros = sumMacros(mealEntries, recipes);

            return (
              <div
                key={meal}
                className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm hover:shadow-md transition-all group"
              >
                <div className="p-3 sm:p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                    {meal[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        {meal}
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {mealEntries.map((entry) => {
                        if (entry.type === 'recipe' && entry.recipeId) {
                          const recipe = getRecipeById(entry.recipeId);
                          if (!recipe) return null;
                          return (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between group/item"
                            >
                              <button
                                onClick={() => onSelectRecipe(recipe)}
                                className="font-bold text-zinc-900 hover:text-emerald-600 transition-colors text-xs"
                              >
                                {recipe.title}
                              </button>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-emerald-600">
                                  {recipe.macros.calories} ккал
                                </span>
                                <button
                                  onClick={() => handleRemoveFromPlanner(entry.id)}
                                  className="p-1 text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        } else if (entry.type === 'product') {
                          return (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between group/item"
                            >
                              <div className="flex flex-col">
                                <span className="font-bold text-zinc-900 text-xs">
                                  {entry.productName}
                                </span>
                                {entry.amount && (
                                  <span className="text-[9px] text-zinc-400 font-medium uppercase">
                                    {entry.amount}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-emerald-600">
                                  {entry.macros?.calories} ккал
                                </span>
                                <button
                                  onClick={() => handleRemoveFromPlanner(entry.id)}
                                  className="p-1 text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                      <div className="relative inline-block">
                        <button
                          onClick={() =>
                            setActiveAddDropdown(activeAddDropdown === `${meal}` ? null : `${meal}`)
                          }
                          className="text-[10px] text-zinc-400 hover:text-emerald-600 transition-colors flex items-center gap-1.5 font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Добавить</span>
                        </button>

                        <AnimatePresence>
                          {activeAddDropdown === `${meal}` && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setActiveAddDropdown(null)}
                              />
                              <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute left-0 mt-2 w-40 bg-white rounded-xl shadow-2xl border border-zinc-100 overflow-hidden z-20"
                              >
                                <button
                                  onClick={() => {
                                    setPickingMealInfo({
                                      date: format(selectedPlannerDate, 'yyyy-MM-dd'),
                                      mealType: meal,
                                    });
                                    setIsRecipePickerOpen(true);
                                    setActiveAddDropdown(null);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 border-b border-zinc-50"
                                >
                                  <ChefHat className="w-3.5 h-3.5 text-emerald-500" /> Рецепт
                                </button>
                                <button
                                  onClick={() => {
                                    setPickingMealInfo({
                                      date: format(selectedPlannerDate, 'yyyy-MM-dd'),
                                      mealType: meal,
                                    });
                                    setIsAddingProduct(true);
                                    setActiveAddDropdown(null);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                                >
                                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-500" /> Продукт
                                </button>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>

                      {mealEntries.length > 0 && (
                        <div className="pt-2 mt-2 border-t border-zinc-50 flex items-center justify-between text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                          <span>Итого:</span>
                          <div className="flex gap-2.5">
                            <span className="text-emerald-600">{mealMacros.calories} ккал</span>
                            <span>Б: {mealMacros.proteins}г</span>
                            <span>Ж: {mealMacros.fats}г</span>
                            <span>У: {mealMacros.carbs}г</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div
            className={cn(
              'mt-4 p-5 rounded-3xl text-white shadow-lg flex items-center justify-between transition-colors',
              isSelectedDateOverLimit
                ? 'bg-red-500 shadow-red-100'
                : 'bg-emerald-600 shadow-emerald-100',
            )}
          >
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-0.5">
                Итого за день
              </h4>
              <p className="text-xl font-bold">{totalMacros.calories} ккал</p>
            </div>
            <div className="flex gap-4 text-xs font-bold">
              <div className="text-center">
                <p className="opacity-70 uppercase text-[9px] mb-0.5">Белки</p>
                <p
                  className={cn(
                    totalMacros.proteins > userProfile.targetProteins &&
                      'text-red-100 underline decoration-2 underline-offset-4',
                  )}
                >
                  {totalMacros.proteins}г
                </p>
              </div>
              <div className="text-center">
                <p className="opacity-70 uppercase text-[9px] mb-0.5">Жиры</p>
                <p
                  className={cn(
                    totalMacros.fats > userProfile.targetFats &&
                      'text-red-100 underline decoration-2 underline-offset-4',
                  )}
                >
                  {totalMacros.fats}г
                </p>
              </div>
              <div className="text-center">
                <p className="opacity-70 uppercase text-[9px] mb-0.5">Углеводы</p>
                <p
                  className={cn(
                    totalMacros.carbs > userProfile.targetCarbs &&
                      'text-red-100 underline decoration-2 underline-offset-4',
                  )}
                >
                  {totalMacros.carbs}г
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              const newMeal = prompt('Введите название приема пищи:');
              if (newMeal && !mealTypes.includes(newMeal)) {
                onMealTypesChange([...mealTypes, newMeal]);
              }
            }}
            className="py-4 border-2 border-dashed border-zinc-200 rounded-3xl text-zinc-400 font-bold hover:border-emerald-300 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Добавить прием пищи
          </button>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const start = startOfWeek(selectedPlannerDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedPlannerDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-8 border-b border-zinc-100">
          {days.map((day) => (
            <div
              key={day.toString()}
              className={cn(
                'p-4 text-center border-r border-zinc-100 last:border-r-0',
                isToday(day) ? 'bg-emerald-50/30' : '',
              )}
            >
              <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">
                {format(day, 'EEE', { locale: ru })}
              </p>
              <p className={cn('font-bold', isToday(day) ? 'text-emerald-600' : 'text-zinc-900')}>
                {format(day, 'd')}
              </p>
            </div>
          ))}
          <div className="p-4 border-l border-zinc-100 bg-zinc-50/50" />
        </div>
        {mealTypes.map((meal) => (
          <div key={meal} className="grid grid-cols-8 border-b border-zinc-100 last:border-b-0">
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayMealEntries = plannerEntries.filter(
                (e) => e.date === dateStr && e.mealType === meal,
              );
              const cellMacros = sumMacros(dayMealEntries, recipes);

              return (
                <div
                  key={day.toString() + meal}
                  className="p-1.5 border-r border-zinc-100 last:border-r-0 min-h-[100px] group relative flex flex-col gap-1.5"
                >
                  {dayMealEntries.map((entry) => {
                    if (entry.type === 'recipe' && entry.recipeId) {
                      const recipe = getRecipeById(entry.recipeId);
                      if (!recipe) return null;
                      return (
                        <div
                          key={entry.id}
                          className="p-1.5 bg-emerald-50/50 rounded-lg border border-emerald-100/50 group/item"
                        >
                          <button
                            onClick={() => onSelectRecipe(recipe)}
                            className="text-[9px] font-bold text-zinc-900 leading-tight line-clamp-2 hover:text-emerald-600 text-left w-full"
                          >
                            {recipe.title}
                          </button>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[8px] font-bold text-emerald-600">
                              {recipe.macros.calories}
                            </span>
                            <button
                              onClick={() => handleRemoveFromPlanner(entry.id)}
                              className="text-zinc-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    } else if (entry.type === 'product') {
                      return (
                        <div
                          key={entry.id}
                          className="p-1.5 bg-zinc-50 rounded-lg border border-zinc-100 group/item"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold text-zinc-900 leading-tight line-clamp-2">
                              {entry.productName}
                            </span>
                            {entry.amount && (
                              <span className="text-[7px] text-zinc-400 font-bold uppercase">
                                {entry.amount}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[8px] font-bold text-emerald-600">
                              {entry.macros?.calories}
                            </span>
                            <button
                              onClick={() => handleRemoveFromPlanner(entry.id)}
                              className="text-zinc-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}

                  {dayMealEntries.length > 0 && (
                    <div className="mt-auto pt-1.5 border-t border-zinc-50 flex flex-col gap-0.5 text-[7px] font-bold text-zinc-400 uppercase">
                      <div className="flex justify-between text-emerald-600">
                        <span>Ккал</span>
                        <span>{cellMacros.calories}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Б/Ж/У</span>
                        <span>
                          {cellMacros.proteins}/{cellMacros.fats}/{cellMacros.carbs}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="relative mt-auto">
                    <button
                      onClick={() =>
                        setActiveAddDropdown(
                          activeAddDropdown === `${dateStr}-${meal}` ? null : `${dateStr}-${meal}`,
                        )
                      }
                      className="w-full h-8 rounded-lg border border-dashed border-zinc-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all flex items-center justify-center text-zinc-200 hover:text-emerald-400"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    <AnimatePresence>
                      {activeAddDropdown === `${dateStr}-${meal}` && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setActiveAddDropdown(null)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full left-0 mb-2 w-32 bg-white rounded-xl shadow-2xl border border-zinc-100 overflow-hidden z-20"
                          >
                            <button
                              onClick={() => {
                                setPickingMealInfo({ date: dateStr, mealType: meal });
                                setIsRecipePickerOpen(true);
                                setActiveAddDropdown(null);
                              }}
                              className="w-full px-3 py-2 text-left text-[10px] font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 border-b border-zinc-50"
                            >
                              <ChefHat className="w-3 h-3 text-emerald-500" /> Рецепт
                            </button>
                            <button
                              onClick={() => {
                                setPickingMealInfo({ date: dateStr, mealType: meal });
                                setIsAddingProduct(true);
                                setActiveAddDropdown(null);
                              }}
                              className="w-full px-3 py-2 text-left text-[10px] font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                            >
                              <ShoppingCart className="w-3 h-3 text-emerald-500" /> Продукт
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
            <div className="p-4 border-l border-zinc-100 bg-zinc-50/50 flex items-center justify-center">
              {/* Empty column as requested */}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-8 bg-zinc-50/50 border-t border-zinc-100">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayEntries = plannerEntries.filter((e) => e.date === dateStr);
            const dayTotalMacros = sumMacros(dayEntries, recipes);

            return (
              <div
                key={day.toString() + 'total'}
                className="p-2 text-center border-r border-zinc-100 last:border-r-0"
              >
                <p className="text-[8px] font-bold text-zinc-400 uppercase mb-0.5">Итого</p>
                <div
                  className={cn(
                    'p-1.5 rounded-lg border transition-colors',
                    dayTotalMacros.calories > userProfile.targetCalories
                      ? 'bg-red-50 border-red-100'
                      : 'bg-zinc-50/50 border-zinc-100',
                  )}
                >
                  <p
                    className={cn(
                      'text-[10px] font-bold mb-0.5',
                      dayTotalMacros.calories > userProfile.targetCalories
                        ? 'text-red-600'
                        : 'text-emerald-600',
                    )}
                  >
                    {dayTotalMacros.calories} ккал
                  </p>
                  <p className="text-[7px] font-bold text-zinc-500">
                    <span
                      className={cn(
                        dayTotalMacros.proteins > userProfile.targetProteins && 'text-red-600',
                      )}
                    >
                      {dayTotalMacros.proteins}
                    </span>{' '}
                    /
                    <span
                      className={cn(dayTotalMacros.fats > userProfile.targetFats && 'text-red-600')}
                    >
                      {dayTotalMacros.fats}
                    </span>{' '}
                    /
                    <span
                      className={cn(
                        dayTotalMacros.carbs > userProfile.targetCarbs && 'text-red-600',
                      )}
                    >
                      {dayTotalMacros.carbs}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
          <div className="p-3 border-l border-zinc-100 flex items-center justify-center">
            <span className="text-[8px] font-bold text-zinc-400 uppercase">Всего</span>
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const start = startOfMonth(selectedPlannerDate);
    const end = endOfMonth(selectedPlannerDate);
    const monthStart = startOfWeek(start, { weekStartsOn: 1 });
    const monthEnd = endOfWeek(end, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50/50">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
            <div key={d} className="p-3 text-center text-[10px] font-bold text-zinc-400 uppercase">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const entries = plannerEntries.filter((e) => e.date === dateStr);
            const totalCals = sumMacros(entries, recipes).calories;
            const isCurrentMonth = day.getMonth() === selectedPlannerDate.getMonth();

            return (
              <div
                key={day.toString()}
                onClick={() => {
                  setSelectedPlannerDate(day);
                  setPlannerViewScale('day');
                }}
                className={cn(
                  'p-2 border-r border-b border-zinc-100 aspect-square cursor-pointer hover:bg-zinc-50 transition-colors group',
                  !isCurrentMonth && 'opacity-30',
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span
                    className={cn(
                      'text-xs font-bold',
                      isToday(day)
                        ? 'w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center'
                        : 'text-zinc-400',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {totalCals > 0 && (
                    <span className="text-[9px] font-bold text-emerald-600">{totalCals}</span>
                  )}
                </div>
                <div className="flex gap-0.5 mt-auto">
                  {mealTypes.map((meal) => {
                    const hasMeal = entries.some((e) => e.mealType === meal);
                    return (
                      <div
                        key={meal}
                        className={cn(
                          'flex-1 h-1 rounded-full',
                          hasMeal ? 'bg-emerald-400' : 'bg-zinc-100',
                        )}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    const start = startOfWeek(selectedPlannerDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedPlannerDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="space-y-8">
        {days.map((day) => {
          const entries = getEntriesForDate(day);
          if (entries.length === 0) return null;

          return (
            <div key={day.toString()} className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  {format(day, 'd')}
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900">{format(day, 'EEEE', { locale: ru })}</h3>
                  <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
                    {format(day, 'd MMMM', { locale: ru })}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {mealTypes.map((meal) => {
                  const mealEntries = entries.filter((e) => e.mealType === meal);
                  if (mealEntries.length === 0) return null;

                  return (
                    <div
                      key={meal}
                      className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm hover:shadow-md transition-all space-y-3"
                    >
                      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">{meal}</p>
                      {mealEntries.map((entry) => {
                        const recipe = getRecipeById(entry.recipeId);
                        if (!recipe) return null;
                        return (
                          <div key={entry.id} className="space-y-1">
                            <button
                              onClick={() => onSelectRecipe(recipe)}
                              className="font-bold text-zinc-900 hover:text-emerald-600 transition-colors text-sm line-clamp-2 mb-1 w-full text-left"
                            >
                              {recipe.title}
                            </button>
                            <div className="flex items-center justify-between text-[10px] font-bold text-emerald-600">
                              <span>{recipe.macros.calories} ккал</span>
                              <button
                                onClick={() => handleRemoveFromPlanner(entry.id)}
                                className="text-zinc-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {days.every((day) => getEntriesForDate(day).length === 0) && (
          <div className="py-20 text-center space-y-4 bg-white rounded-3xl border border-dashed border-zinc-200">
            <Calendar className="w-12 h-12 text-zinc-200 mx-auto" />
            <p className="text-zinc-400">На эту неделю ничего не запланировано</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-8 pb-24">
        {isSelectedDateOverLimit && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500 text-white p-4 rounded-3xl flex items-center gap-4 shadow-lg shadow-red-100"
          >
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <p className="font-bold uppercase tracking-widest text-sm">
              Вы превышаете норму, допустимую программой
            </p>
          </motion.div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold font-display mb-2">
              Дорогая (ой) {userProfile.name || '(Имя)'} составь твой твой идеальный план рациона
              тут
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
              <button
                onClick={() => setPlannerViewMode('calendar')}
                className={cn(
                  'p-2 rounded-lg transition-all',
                  plannerViewMode === 'calendar'
                    ? 'bg-white shadow-sm text-emerald-600'
                    : 'text-zinc-400 hover:text-zinc-600',
                )}
              >
                <Calendar className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPlannerViewMode('list')}
                className={cn(
                  'p-2 rounded-lg transition-all',
                  plannerViewMode === 'list'
                    ? 'bg-white shadow-sm text-emerald-600'
                    : 'text-zinc-400 hover:text-zinc-600',
                )}
              >
                <List className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 bg-zinc-100 p-1.5 rounded-2xl self-start">
              {(['day', 'week', 'month'] as PlannerViewScale[]).map((scale) => (
                <button
                  key={scale}
                  onClick={() => setPlannerViewScale(scale)}
                  className={cn(
                    'px-6 py-2 rounded-xl text-sm font-bold transition-all',
                    plannerViewScale === scale
                      ? 'bg-white shadow-sm text-emerald-600'
                      : 'text-zinc-500 hover:text-zinc-700',
                  )}
                >
                  {scale === 'day' ? 'День' : scale === 'week' ? 'Неделя' : 'Месяц'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {plannerViewScale === 'month' ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedPlannerDate(subMonths(selectedPlannerDate, 1))}
                  className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-bold text-xl min-w-[140px] text-center capitalize">
                  {format(selectedPlannerDate, 'LLLL yyyy', { locale: ru })}
                </h3>
                <button
                  onClick={() => setSelectedPlannerDate(addMonths(selectedPlannerDate, 1))}
                  className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  onClick={() =>
                    setSelectedPlannerDate(
                      subDays(selectedPlannerDate, plannerViewScale === 'week' ? 7 : 1),
                    )
                  }
                  className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-bold text-xl min-w-[200px] text-center">
                  {plannerViewScale === 'week'
                    ? `${format(startOfWeek(selectedPlannerDate, { weekStartsOn: 1 }), 'd MMM')} — ${format(endOfWeek(selectedPlannerDate, { weekStartsOn: 1 }), 'd MMM')}`
                    : format(selectedPlannerDate, 'd MMMM', { locale: ru })}
                </h3>
                <button
                  onClick={() =>
                    setSelectedPlannerDate(
                      addDays(selectedPlannerDate, plannerViewScale === 'week' ? 7 : 1),
                    )
                  }
                  className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                const entries =
                  plannerViewScale === 'day'
                    ? getEntriesForDate(selectedPlannerDate)
                    : plannerEntries.filter((e) => {
                        const d = parseISO(e.date);
                        const start = startOfWeek(selectedPlannerDate, { weekStartsOn: 1 });
                        const end = endOfWeek(selectedPlannerDate, { weekStartsOn: 1 });
                        return d >= start && d <= end;
                      });

                const ingredientMap: Record<
                  string,
                  { amount: string; dishes: Set<string>; isBasic: boolean }
                > = {};

                entries.forEach((e) => {
                  const recipe = getRecipeById(e.recipeId);
                  if (recipe) {
                    recipe.ingredients.forEach((ing) => {
                      const isBasic = isStaple(ing);
                      const lowerIng = ing.toLowerCase();

                      // Try to find if we already have this ingredient (very basic fuzzy match)
                      let key = ing;
                      const existingKey = Object.keys(ingredientMap).find(
                        (k) =>
                          k.toLowerCase().includes(lowerIng) || lowerIng.includes(k.toLowerCase()),
                      );
                      if (existingKey) key = existingKey;

                      let entry = ingredientMap[key];
                      if (!entry) {
                        entry = { amount: '', dishes: new Set(), isBasic };
                        ingredientMap[key] = entry;
                      }

                      entry.dishes.add(recipe.title);

                      // Simple amount extraction and summing attempt
                      const amountMatch = ing.match(
                        /^([\d.,/]+(?:\s*[г|кг|мл|л|шт|ст\.л|ч\.л|зубчик|щепотка|пучок|банка|упаковка])?)/i,
                      );
                      if (amountMatch) {
                        const newAmount = (amountMatch[1] ?? '').trim();
                        if (!entry.amount) {
                          entry.amount = newAmount;
                        } else {
                          const currentVal = parseFloat(entry.amount.replace(',', '.'));
                          const newVal = parseFloat(newAmount.replace(',', '.'));
                          const currentUnit = entry.amount.replace(/[\d.,/\s]/g, '');
                          const newUnit = newAmount.replace(/[\d.,/\s]/g, '');

                          if (!isNaN(currentVal) && !isNaN(newVal) && currentUnit === newUnit) {
                            entry.amount = currentVal + newVal + currentUnit;
                          } else {
                            entry.amount += `, ${newAmount}`;
                          }
                        }
                        // Remove amount from name if it was at the start
                        if (key === ing) {
                          const nameOnly = ing.replace(amountMatch[0], '').trim();
                          if (nameOnly) {
                            delete ingredientMap[key];
                            key = nameOnly;
                            const existing = ingredientMap[key];
                            if (!existing) {
                              ingredientMap[key] = {
                                amount: newAmount,
                                dishes: new Set([recipe.title]),
                                isBasic,
                              };
                            } else {
                              existing.dishes.add(recipe.title);
                            }
                          }
                        }
                      }
                    });
                  }
                });

                for (const [name, info] of Object.entries(ingredientMap)) {
                  await cartRepo.add({
                    name,
                    amount: info.amount || 'по вкусу',
                    sourceDishes: Array.from(info.dishes),
                    checked: false,
                    isBasic: info.isBasic,
                    createdAt: new Date().toISOString(),
                  });
                }

                onNavigateToCart();
                alert(`Добавлено ${Object.keys(ingredientMap).length} ингредиентов в корзину`);
              }}
              className="flex items-center gap-2 bg-white border border-zinc-200 px-5 py-2.5 rounded-2xl text-zinc-600 font-bold hover:bg-zinc-50 transition-all shadow-sm"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Список покупок</span>
            </button>
          </div>
        </div>

        {plannerViewMode === 'calendar' ? (
          <>
            {plannerViewScale === 'day' && renderDayView()}
            {plannerViewScale === 'week' && renderWeekView()}
            {plannerViewScale === 'month' && renderMonthView()}
          </>
        ) : (
          renderListView()
        )}
      </div>

      {/* Product Add Modal */}
      <AnimatePresence>
        {isAddingProduct && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingProduct(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Добавить продукт в план</h3>
                <button
                  onClick={() => setIsAddingProduct(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddProductToPlanner} className="space-y-6">
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
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">
                        Ккал
                      </label>
                      <input
                        type="number"
                        value={productFormData.calories}
                        onChange={(e) =>
                          setProductFormData({
                            ...productFormData,
                            calories: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">
                        Белки (г)
                      </label>
                      <input
                        type="number"
                        value={productFormData.proteins}
                        onChange={(e) =>
                          setProductFormData({
                            ...productFormData,
                            proteins: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">
                        Жиры (г)
                      </label>
                      <input
                        type="number"
                        value={productFormData.fats}
                        onChange={(e) =>
                          setProductFormData({
                            ...productFormData,
                            fats: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">
                        Углеводы (г)
                      </label>
                      <input
                        type="number"
                        value={productFormData.carbs}
                        onChange={(e) =>
                          setProductFormData({
                            ...productFormData,
                            carbs: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 bg-white border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Добавить в план
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recipe Picker Modal */}
      <AnimatePresence>
        {isRecipePickerOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRecipePickerOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">Выбрать рецепт</h3>
                <button
                  onClick={() => setIsRecipePickerOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      onClick={() =>
                        handleAddToPlanner(
                          pickingMealInfo!.date,
                          pickingMealInfo!.mealType,
                          recipe.id,
                        )
                      }
                      className="flex items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                        <img
                          src={recipe.image || `https://picsum.photos/seed/${recipe.id}/200/200`}
                          alt={recipe.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                          {recipe.title}
                        </p>
                        <p className="text-xs text-zinc-400">{recipe.macros.calories} ккал</p>
                      </div>
                    </button>
                  ))}
                </div>
                {recipes.length === 0 && (
                  <div className="text-center py-10 text-zinc-400">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>У вас пока нет рецептов</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
