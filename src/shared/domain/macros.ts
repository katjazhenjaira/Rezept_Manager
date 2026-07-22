import type { Macros, PlannerEntry, Recipe, UserProfile, ActiveNutritionPlan } from './types';

export type NutritionTargets = {
  /** Имя активного плана; `null` — активного плана нет, цели взяты из профиля.
   *  Подпись для пользователя резолвит UI-слой: домен не содержит UI-строк. */
  name: string | null;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  allowedProducts: string[];
  forbiddenProducts: string[];
};

export function sumMacros(entries: PlannerEntry[], recipes: Recipe[]): Macros {
  return entries.reduce<Macros>(
    (acc, entry) => {
      const macros =
        entry.type === 'recipe'
          ? recipes.find((r) => r.id === entry.recipeId)?.macros
          : entry.macros;
      if (!macros) return acc;
      return {
        calories: acc.calories + macros.calories,
        proteins: acc.proteins + macros.proteins,
        fats: acc.fats + macros.fats,
        carbs: acc.carbs + macros.carbs,
      };
    },
    { calories: 0, proteins: 0, fats: 0, carbs: 0 },
  );
}

export function remainingMacros(targets: Macros, actual: Macros): Macros {
  return {
    calories: Math.max(0, targets.calories - actual.calories),
    proteins: Math.max(0, targets.proteins - actual.proteins),
    fats: Math.max(0, targets.fats - actual.fats),
    carbs: Math.max(0, targets.carbs - actual.carbs),
  };
}

export function scaleMacros(macros: Macros, portionCount: number, baseServings: number): Macros {
  const base = Math.max(1, baseServings);
  return {
    calories: Math.round((macros.calories * portionCount) / base),
    proteins: Math.round((macros.proteins * portionCount) / base),
    fats: Math.round((macros.fats * portionCount) / base),
    carbs: Math.round((macros.carbs * portionCount) / base),
  };
}

export function resolveActiveTargets(
  plan: ActiveNutritionPlan | null,
  profile: UserProfile,
): NutritionTargets {
  if (plan) {
    return {
      name: plan.name,
      calories: plan.calories,
      proteins: plan.proteins,
      fats: plan.fats,
      carbs: plan.carbs,
      allowedProducts: plan.allowedProducts ?? [],
      forbiddenProducts: plan.forbiddenProducts ?? [],
    };
  }
  return {
    name: null,
    calories: profile.targetCalories,
    proteins: profile.targetProteins,
    fats: profile.targetFats,
    carbs: profile.targetCarbs,
    allowedProducts: [],
    forbiddenProducts: [],
  };
}
