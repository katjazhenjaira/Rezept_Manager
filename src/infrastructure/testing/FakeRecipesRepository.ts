import type { RecipesRepository } from '@/services/RecipesRepository';
import type { Recipe } from '@/shared/domain/types';

export class FakeRecipesRepository implements RecipesRepository {
  private items: Recipe[] = [];
  private listeners = new Set<(recipes: Recipe[]) => void>();
  private counter = 0;

  private emit(): void {
    const snapshot = [...this.items];
    this.listeners.forEach(cb => cb(snapshot));
  }

  subscribeAll(callback: (recipes: Recipe[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.items]);
    return () => this.listeners.delete(callback);
  }

  async add(data: Omit<Recipe, 'id'>): Promise<string> {
    const id = String(++this.counter);
    this.items.push({ id, ...data });
    this.emit();
    return id;
  }

  async update(id: string, data: Partial<Omit<Recipe, 'id'>>): Promise<void> {
    const idx = this.items.findIndex(r => r.id === id);
    if (idx === -1) return;
    this.items[idx] = { ...this.items[idx]!, ...data };
    this.emit();
  }

  async delete(id: string): Promise<void> {
    const before = this.items.length;
    this.items = this.items.filter(r => r.id !== id);
    if (this.items.length !== before) this.emit();
  }

  async getById(id: string): Promise<Recipe | null> {
    return this.items.find(r => r.id === id) ?? null;
  }

  reset(): void {
    this.items = [];
    this.listeners.clear();
    this.counter = 0;
  }
}
