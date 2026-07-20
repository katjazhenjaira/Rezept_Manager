export abstract class FakeCollectionRepository<T extends { id: string }> {
  protected items: T[] = [];
  private listeners = new Set<(items: T[]) => void>();
  private counter = 0;

  protected emit(): void {
    const snapshot = [...this.items];
    this.listeners.forEach(cb => cb(snapshot));
  }

  get listenerCount(): number { return this.listeners.size; }

  subscribeAll(callback: (items: T[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.items]);
    return () => this.listeners.delete(callback);
  }

  async add(data: Omit<T, 'id'>): Promise<string> {
    const id = String(++this.counter);
    this.items.push({ id, ...data } as T);
    this.emit();
    return id;
  }

  async delete(id: string): Promise<void> {
    const before = this.items.length;
    this.items = this.items.filter(i => i.id !== id);
    if (this.items.length !== before) this.emit();
  }

  reset(): void {
    this.items = [];
    this.listeners.clear();
    this.counter = 0;
  }
}
