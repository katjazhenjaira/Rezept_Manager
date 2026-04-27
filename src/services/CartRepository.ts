import type { CartItem } from '@/shared/domain/types';

export interface CartRepository {
  subscribeAll(callback: (items: CartItem[]) => void): () => void;
  add(data: Omit<CartItem, 'id'>): Promise<string>;
  update(id: string, data: Partial<Omit<CartItem, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}
