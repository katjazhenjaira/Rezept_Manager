import type { ProgramsRepository } from '@/services/ProgramsRepository';
import type { Program } from '@/shared/domain/types';

export class FakeProgramsRepository implements ProgramsRepository {
  private items: Program[] = [];
  private listeners = new Set<(programs: Program[]) => void>();
  private counter = 0;

  private emit(): void {
    const snapshot = [...this.items];
    this.listeners.forEach(cb => cb(snapshot));
  }

  subscribeAll(callback: (programs: Program[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.items]);
    return () => this.listeners.delete(callback);
  }

  async add(data: Omit<Program, 'id'>): Promise<string> {
    const id = String(++this.counter);
    this.items.push({ id, ...data });
    this.emit();
    return id;
  }

  async update(id: string, data: Partial<Omit<Program, 'id'>>): Promise<void> {
    const idx = this.items.findIndex(p => p.id === id);
    if (idx === -1) return;
    this.items[idx] = { ...this.items[idx]!, ...data };
    this.emit();
  }

  async delete(id: string): Promise<void> {
    const before = this.items.length;
    this.items = this.items.filter(p => p.id !== id);
    if (this.items.length !== before) this.emit();
  }

  async getById(id: string): Promise<Program | null> {
    return this.items.find(p => p.id === id) ?? null;
  }

  reset(): void {
    this.items = [];
    this.listeners.clear();
    this.counter = 0;
  }
}
