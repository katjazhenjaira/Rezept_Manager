// src/features/tracker/TrackerView.tsx
import React, { useMemo, useState } from 'react';
import {
  Target,
  Droplets,
  AlertCircle,
  Sparkles,
  Loader2,
  Check,
  ChevronRight,
  Calendar,
  Settings2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { useRepositories } from '@/app/providers/RepositoryContext';
import { useData } from '@/app/providers/DataContext';
import { useNutritionPlan, useUserProfile } from '@/app/providers/UserProfileContext';
import { aiClient } from '@/services/ai/aiClient';
import {
  sumMacros,
  remainingMacros as computeRemainingMacros,
  resolveActiveTargets,
} from '@/shared/domain/macros';
import { DEFAULT_PROFILE } from '@/shared/domain/defaults';
import { recipeAllergens, productAllergens } from '@/shared/domain/allergies';
import type { Recipe } from '@/shared/domain/types';
import type { FillRemainingResponse, FillRemainingOption } from '@/services/ai/contracts';

// Локальное состояние накапливает options из нескольких ответов API (клик "ещё альтернативы"),
// поэтому строгий tuple-контракт ответа (ровно 3) здесь не подходит — нужен обычный массив.
type AccumulatedSuggestion = Omit<FillRemainingResponse, 'options'> & {
  options: FillRemainingOption[];
};
import { ProgramSelectionModal } from './ProgramSelectionModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Подпись для случая, когда активного плана нет и цели берутся из профиля.
 *  Живёт в UI-слое: `resolveActiveTargets()` возвращает `name: null` (CONV-2). */
const DEFAULT_PLAN_LABEL = 'По умолчанию (из настроек)';

export type TrackerViewProps = {
  checkedEntries: string[];
  onCheckedEntriesChange: (entries: string[]) => void;
  mealTypes: string[];
  onSelectRecipe: (recipe: Recipe) => void;
  onNavigateToPlanner: () => void;
};

export function TrackerView({
  checkedEntries,
  onCheckedEntriesChange,
  mealTypes,
  onSelectRecipe,
  onNavigateToPlanner,
}: TrackerViewProps) {
  const { plannerEntries, recipes } = useData();
  const { activeNutritionPlan } = useNutritionPlan();
  const { userProfile } = useUserProfile();
  const { planner: plannerRepo } = useRepositories();

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<AccumulatedSuggestion | null>(null);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [isProgramSelectionOpen, setIsProgramSelectionOpen] = useState(false);

  // Профиль приходит асинхронно: до его загрузки компонент рендерится с дефолтами,
  // иначе цели показывались бы пустыми («Твоя цель:  мл»).
  const profile = userProfile ?? DEFAULT_PROFILE;

  const today = format(new Date(), 'yyyy-MM-dd');

  // Три прохода по коллекциям (два filter + sumMacros по всем рецептам) раньше выполнялись
  // на каждом рендере — включая рендеры от isSuggesting, выбора вариантов и открытия
  // модалки выбора программы (PERF-1). При длинной истории планера это полный скан на клик.
  const todayEntries = useMemo(
    () => plannerEntries.filter((e) => e.date === today),
    [plannerEntries, today],
  );
  const checkedEntriesData = useMemo(
    () => todayEntries.filter((e) => checkedEntries.includes(e.id)),
    [todayEntries, checkedEntries],
  );

  const actualMacros = useMemo(
    () => sumMacros(checkedEntriesData, recipes),
    [checkedEntriesData, recipes],
  );
  const currentTargets = resolveActiveTargets(activeNutritionPlan, profile);
  const currentPlanLabel = currentTargets.name ?? DEFAULT_PLAN_LABEL;
  const remainingMacros = computeRemainingMacros(currentTargets, actualMacros);

  const handleSuggest = async (isAlternative = false) => {
    if (remainingMacros.calories < 50 && !isAlternative) {
      alert('У вас осталось слишком мало калорий для рекомендаций!');
      return;
    }

    setIsSuggesting(true);
    if (!isAlternative) {
      setSuggestion(null);
      setSelectedSuggestionIds([]);
    }

    try {
      const result = await aiClient.fillRemaining({
        remaining: remainingMacros,
        planName: currentPlanLabel,
        allergies: profile.allergies,
        activeProgramRules: {
          allowedProducts: activeNutritionPlan?.allowedProducts ?? [],
          forbiddenProducts: activeNutritionPlan?.forbiddenProducts ?? [],
        },
        userRecipes: recipes.map((r) => ({ id: r.id, title: r.title, macros: r.macros })),
      });

      if (isAlternative) {
        setSuggestion((prev) =>
          prev ? { ...result, options: [...prev.options, ...result.options] } : result,
        );
      } else {
        setSuggestion(result);
      }
    } catch (error) {
      console.error('Error getting suggestion:', error);
      alert('Не удалось получить рекомендацию');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAddSelectedSuggestions = async () => {
    if (!suggestion || selectedSuggestionIds.length === 0) return;

    const selectedOptions = suggestion.options.filter((opt) =>
      selectedSuggestionIds.includes(opt.id),
    );

    // Safety-critical constraint №1: AI получает список аллергий в промпте, но это доверие
    // к модели, а не гейт. Детерминированная проверка обязана быть здесь, перед записью.
    const allergies = profile.allergies;
    const allergens = new Set<string>();
    for (const option of selectedOptions) {
      if (option.type === 'recipe') {
        const recipe = recipes.find((r) => r.id === option.recipeId);
        if (recipe) {
          recipeAllergens(recipe, allergies).forEach((a) => allergens.add(a));
        }
      } else {
        productAllergens(option.description, allergies).forEach((a) => allergens.add(a));
      }
    }
    if (allergens.size > 0) {
      if (
        !confirm(
          `Осторожно! Среди выбранных вариантов есть ингредиенты, на которые у вас аллергия: ${[...allergens].join(', ')}. Все равно добавить?`,
        )
      ) {
        return;
      }
    }

    try {
      for (const option of selectedOptions) {
        await plannerRepo.add({
          date: today,
          mealType: 'Перекус',
          type: option.type,
          ...(option.type === 'recipe' && option.recipeId ? { recipeId: option.recipeId } : {}),
          ...(option.type === 'product' ? { productName: option.description } : {}),
          macros: option.macros,
        });
      }
      setSuggestion(null);
      setSelectedSuggestionIds([]);
      alert('Выбранные варианты добавлены в ваш рацион на сегодня!');
    } catch (error) {
      console.error('Error adding suggestions:', error);
      alert('Не удалось добавить варианты в рацион');
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-zinc-900">Трекер твоего питания сегодня</h2>
          <p className="text-zinc-500 text-sm">Следи за прогрессом и достигай своих целей</p>
        </div>

        {/* Water Reminder */}
        <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              <Droplets className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900">
                Не забудь пить достаточно воды сегодня!
              </h3>
              <p className="text-blue-700 text-sm">Твоя цель: {profile.waterGoal} мл</p>
            </div>
          </div>
          <div className="text-blue-600 font-bold text-xl">
            {Math.round(profile.currentWeight * 35)} мл/день
          </div>
        </div>

        {/* Active Plan Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase">Текущий план</p>
              <h3 className="text-sm font-bold text-zinc-900">
                {currentPlanLabel}
                {activeNutritionPlan?.subfolderName && (
                  <span className="text-emerald-600 ml-1">
                    / {activeNutritionPlan.subfolderName}
                  </span>
                )}
              </h3>
            </div>
          </div>
          <button
            onClick={() => setIsProgramSelectionOpen(true)}
            className="flex items-center gap-2 bg-white border border-zinc-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all shadow-sm"
          >
            <Settings2 className="w-4 h-4" />
            Выбрать программу
          </button>
        </div>

        {/* Macros Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(
            [
              {
                label: 'Калории',
                key: 'calories' as const,
                unit: 'ккал',
                okColor: 'bg-emerald-500',
              },
              { label: 'Белки', key: 'proteins' as const, unit: 'г', okColor: 'bg-blue-500' },
              { label: 'Жиры', key: 'fats' as const, unit: 'г', okColor: 'bg-orange-500' },
              { label: 'Углеводы', key: 'carbs' as const, unit: 'г', okColor: 'bg-purple-500' },
            ] as const
          ).map(({ label, key, unit, okColor }) => {
            const actual = actualMacros[key];
            const target = currentTargets[key];
            const exceeded = actual > target;
            return (
              <div
                key={key}
                className={cn(
                  'bg-white p-6 rounded-3xl border shadow-sm transition-all duration-300',
                  exceeded ? 'border-red-500 shadow-red-50' : 'border-zinc-100',
                )}
              >
                <p className="text-xs font-bold text-zinc-400 uppercase mb-1">{label}</p>
                <div className="flex items-end gap-2">
                  <span
                    className={cn(
                      'text-2xl font-bold',
                      exceeded ? 'text-red-600' : 'text-zinc-900',
                    )}
                  >
                    {actual}
                    {key !== 'calories' ? 'г' : ''}
                  </span>
                  <span className="text-zinc-400 text-sm mb-1">
                    / {target} {unit}
                  </span>
                </div>
                {exceeded && (
                  <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> вы превысили норму
                  </p>
                )}
                <div className="mt-4 h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-500',
                      exceeded ? 'bg-red-500' : okColor,
                    )}
                    style={{ width: `${Math.min(100, (actual / (target || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Today's Meals */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-zinc-900">Твой план на сегодня</h3>
          {todayEntries.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-100 p-12 text-center">
              <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-zinc-200" />
              </div>
              <p className="text-zinc-500 text-sm">На сегодня ничего не запланировано</p>
              <button
                onClick={onNavigateToPlanner}
                className="mt-4 text-emerald-600 font-bold hover:text-emerald-700"
              >
                Перейти в планер
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {mealTypes.map((meal) => {
                const mealEntries = todayEntries.filter((e) => e.mealType === meal);
                if (mealEntries.length === 0) return null;
                return (
                  <div
                    key={meal}
                    className="bg-white rounded-3xl border border-zinc-100 overflow-hidden shadow-sm"
                  >
                    <div className="px-6 py-4 bg-zinc-50/50 border-b border-zinc-100 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                        {meal}
                      </h4>
                    </div>
                    <div className="divide-y divide-zinc-50">
                      {mealEntries.map((entry) => {
                        const isChecked = checkedEntries.includes(entry.id);
                        const recipe =
                          entry.type === 'recipe'
                            ? recipes.find((r) => r.id === entry.recipeId)
                            : null;
                        const title = entry.type === 'recipe' ? recipe?.title : entry.productName;
                        const calories =
                          entry.type === 'recipe'
                            ? recipe?.macros.calories
                            : entry.macros?.calories;
                        return (
                          <div key={entry.id} className="p-4 flex items-center gap-4 group">
                            <button
                              onClick={() => {
                                if (isChecked) {
                                  onCheckedEntriesChange(
                                    checkedEntries.filter((id) => id !== entry.id),
                                  );
                                } else {
                                  onCheckedEntriesChange([...checkedEntries, entry.id]);
                                }
                              }}
                              className={cn(
                                'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all',
                                isChecked
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-zinc-200 text-transparent',
                              )}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <div className="flex-1">
                              <p
                                className={cn(
                                  'font-bold text-zinc-900',
                                  isChecked && 'line-through opacity-50',
                                )}
                              >
                                {title}
                              </p>
                              <p className="text-xs text-zinc-400">{calories} ккал</p>
                            </div>
                            {entry.type === 'recipe' && recipe && (
                              <button
                                onClick={() => onSelectRecipe(recipe)}
                                className="p-2 text-zinc-300 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Suggestion Section */}
        <div className="pt-8 border-t border-zinc-100">
          <div className="flex flex-col items-start gap-4">
            <button
              onClick={() => void handleSuggest(false)}
              disabled={isSuggesting}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSuggesting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Подбираем варианты...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Заполнить остаток кбжу</span>
                </>
              )}
            </button>
            <p className="text-zinc-500 text-sm max-w-md">
              Ты не знаешь что съесть на остаток твоих кбжу сегодня? Нажми на кнопку и получи
              варианты на выбор
            </p>
          </div>

          <AnimatePresence>
            {suggestion && !isSuggesting && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="mt-8 space-y-6"
              >
                <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100">
                  <h4 className="font-bold text-emerald-900 mb-1 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Рекомендации для тебя
                  </h4>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-3">
                    Подобрано согласно вашему плану: {activeNutritionPlan?.name ?? 'По умолчанию'}
                  </p>
                  <p className="text-emerald-700 text-sm mb-6">{suggestion.reason}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {suggestion.options.map((option) => (
                      <div
                        key={option.id}
                        className={cn(
                          'bg-white p-4 rounded-2xl border transition-all cursor-pointer',
                          selectedSuggestionIds.includes(option.id)
                            ? 'border-emerald-500 shadow-md'
                            : 'border-zinc-100 hover:border-emerald-200',
                        )}
                        onClick={() => {
                          if (selectedSuggestionIds.includes(option.id)) {
                            setSelectedSuggestionIds(
                              selectedSuggestionIds.filter((id) => id !== option.id),
                            );
                          } else {
                            setSelectedSuggestionIds([...selectedSuggestionIds, option.id]);
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center transition-all mt-1',
                              selectedSuggestionIds.includes(option.id)
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-zinc-200 text-transparent',
                            )}
                          >
                            <Check className="w-3 h-3" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-zinc-900 text-sm mb-2">
                              {option.description}
                            </p>
                            <div className="flex gap-3 text-[10px] font-bold text-zinc-400 uppercase">
                              <span className="text-emerald-600">
                                {option.macros.calories} ккал
                              </span>
                              <span>Б: {option.macros.proteins}г</span>
                              <span>Ж: {option.macros.fats}г</span>
                              <span>У: {option.macros.carbs}г</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 mt-6">
                    {selectedSuggestionIds.length > 0 && (
                      <button
                        onClick={() => void handleAddSelectedSuggestions()}
                        className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                      >
                        Добавить в рацион
                      </button>
                    )}
                    <button
                      onClick={() => void handleSuggest(true)}
                      disabled={isSuggesting}
                      className="flex-1 py-4 bg-white border border-emerald-200 text-emerald-600 rounded-2xl font-bold hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                    >
                      {isSuggesting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Предложить альтернативу
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ProgramSelectionModal
        isOpen={isProgramSelectionOpen}
        onClose={() => setIsProgramSelectionOpen(false)}
      />
    </>
  );
}
