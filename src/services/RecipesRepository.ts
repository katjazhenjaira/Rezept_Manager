import type { Recipe } from '@/shared/domain/types';

export interface RecipesRepository {
  subscribeAll(callback: (recipes: Recipe[]) => void): () => void;
  add(data: Omit<Recipe, 'id'>): Promise<string>;
  update(id: string, data: Partial<Omit<Recipe, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Recipe | null>;
}
