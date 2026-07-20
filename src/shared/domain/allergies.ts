import type { Recipe } from './types';

function matchingAllergens(texts: string[], allergies: string[]): string[] {
  return allergies.filter((allergy) =>
    texts.some((text) => text.toLowerCase().includes(allergy.toLowerCase())),
  );
}

export function recipeAllergens(recipe: Recipe, allergies: string[]): string[] {
  return matchingAllergens(recipe.ingredients, allergies);
}

export function recipeHasAllergens(recipe: Recipe, allergies: string[]): boolean {
  return recipeAllergens(recipe, allergies).length > 0;
}

export function productAllergens(productName: string, allergies: string[]): string[] {
  return matchingAllergens([productName], allergies);
}
