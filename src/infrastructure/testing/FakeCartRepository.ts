import type { CartRepository } from '@/services/CartRepository';
import type { CartItem } from '@/shared/domain/types';
import { FakeCollectionRepository } from './FakeCollectionRepository';

export class FakeCartRepository
  extends FakeCollectionRepository<CartItem>
  implements CartRepository
{
  async update(id: string, data: Partial<Omit<CartItem, 'id'>>): Promise<void> {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    this.items[idx] = { ...this.items[idx]!, ...data };
    this.emit();
  }

  async deleteAll(): Promise<void> {
    if (this.items.length === 0) return;
    this.items = [];
    this.emit();
  }
}
