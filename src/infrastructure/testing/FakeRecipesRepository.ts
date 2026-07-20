import type { RecipesRepository } from '@/services/RecipesRepository';
import type { Recipe } from '@/shared/domain/types';
import { FakeCollectionRepository } from './FakeCollectionRepository';

export class FakeRecipesRepository extends FakeCollectionRepository<Recipe> implements RecipesRepository {
  async update(id: string, data: Partial<Omit<Recipe, 'id'>>): Promise<void> {
    const idx = this.items.findIndex(r => r.id === id);
    if (idx === -1) return;
    this.items[idx] = { ...this.items[idx]!, ...data };
    this.emit();
  }

  async getById(id: string): Promise<Recipe | null> {
    return this.items.find(r => r.id === id) ?? null;
  }
}
