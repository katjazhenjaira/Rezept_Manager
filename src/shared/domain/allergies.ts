import type { Recipe } from './types';

export function recipeAllergens(recipe: Recipe, allergies: string[]): string[] {
  return allergies.filter((allergy) =>
    recipe.ingredients.some((ing) =>
      ing.toLowerCase().includes(allergy.toLowerCase())
    )
  );
}

export function recipeHasAllergens(recipe: Recipe, allergies: string[]): boolean {
  return recipeAllergens(recipe, allergies).length > 0;
}
