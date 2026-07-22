export abstract class FakeCollectionRepository<T extends { id: string }> {
  protected items: T[] = [];
  private listeners = new Set<(items: T[]) => void>();
  private errorListeners = new Set<(error: Error) => void>();
  private counter = 0;

  protected emit(): void {
    const snapshot = [...this.items];
    this.listeners.forEach((cb) => cb(snapshot));
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  /** Имитирует падение подписки (истёкший токен, отзыв прав) — аналог onSnapshot error-колбэка. */
  failSubscriptions(error: Error): void {
    this.errorListeners.forEach((cb) => cb(error));
  }

  subscribeAll(callback: (items: T[]) => void, onError?: (error: Error) => void): () => void {
    this.listeners.add(callback);
    if (onError) this.errorListeners.add(onError);
    callback([...this.items]);
    return () => {
      this.listeners.delete(callback);
      if (onError) this.errorListeners.delete(onError);
    };
  }

  async add(data: Omit<T, 'id'>): Promise<string> {
    const id = String(++this.counter);
    this.items.push({ id, ...data } as T);
    this.emit();
    return id;
  }

  async delete(id: string): Promise<void> {
    const before = this.items.length;
    this.items = this.items.filter((i) => i.id !== id);
    if (this.items.length !== before) this.emit();
  }

  reset(): void {
    this.items = [];
    this.listeners.clear();
    this.errorListeners.clear();
    this.counter = 0;
  }
}
