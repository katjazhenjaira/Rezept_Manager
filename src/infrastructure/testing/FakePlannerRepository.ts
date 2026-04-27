import type { PlannerRepository } from '@/services/PlannerRepository';
import type { PlannerEntry } from '@/shared/domain/types';

export class FakePlannerRepository implements PlannerRepository {
  private items: PlannerEntry[] = [];
  private listeners = new Set<(entries: PlannerEntry[]) => void>();
  private counter = 0;

  private emit(): void {
    const snapshot = [...this.items];
    this.listeners.forEach(cb => cb(snapshot));
  }

  subscribeAll(callback: (entries: PlannerEntry[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.items]);
    return () => this.listeners.delete(callback);
  }

  async add(data: Omit<PlannerEntry, 'id'>): Promise<string> {
    const id = String(++this.counter);
    this.items.push({ id, ...data });
    this.emit();
    return id;
  }

  async delete(id: string): Promise<void> {
    const before = this.items.length;
    this.items = this.items.filter(e => e.id !== id);
    if (this.items.length !== before) this.emit();
  }

  reset(): void {
    this.items = [];
    this.listeners.clear();
    this.counter = 0;
  }
}
