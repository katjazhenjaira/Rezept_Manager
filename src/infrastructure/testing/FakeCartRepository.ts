import type { CartRepository } from '@/services/CartRepository';
import type { CartItem } from '@/shared/domain/types';

export class FakeCartRepository implements CartRepository {
  private items: CartItem[] = [];
  private listeners = new Set<(items: CartItem[]) => void>();
  private counter = 0;

  private emit(): void {
    const snapshot = [...this.items];
    this.listeners.forEach(cb => cb(snapshot));
  }

  subscribeAll(callback: (items: CartItem[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.items]);
    return () => this.listeners.delete(callback);
  }

  async add(data: Omit<CartItem, 'id'>): Promise<string> {
    const id = String(++this.counter);
    this.items.push({ id, ...data });
    this.emit();
    return id;
  }

  async update(id: string, data: Partial<Omit<CartItem, 'id'>>): Promise<void> {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return;
    this.items[idx] = { ...this.items[idx]!, ...data };
    this.emit();
  }

  async delete(id: string): Promise<void> {
    const before = this.items.length;
    this.items = this.items.filter(i => i.id !== id);
    if (this.items.length !== before) this.emit();
  }

  async deleteAll(): Promise<void> {
    if (this.items.length === 0) return;
    this.items = [];
    this.emit();
  }

  reset(): void {
    this.items = [];
    this.listeners.clear();
    this.counter = 0;
  }
}
