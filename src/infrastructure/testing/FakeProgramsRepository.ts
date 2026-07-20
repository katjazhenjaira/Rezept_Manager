import type { ProgramsRepository } from '@/services/ProgramsRepository';
import type { Program } from '@/shared/domain/types';
import { FakeCollectionRepository } from './FakeCollectionRepository';

export class FakeProgramsRepository
  extends FakeCollectionRepository<Program>
  implements ProgramsRepository
{
  async update(id: string, data: Partial<Omit<Program, 'id'>>): Promise<void> {
    const idx = this.items.findIndex((p) => p.id === id);
    if (idx === -1) return;
    this.items[idx] = { ...this.items[idx]!, ...data };
    this.emit();
  }

  async getById(id: string): Promise<Program | null> {
    return this.items.find((p) => p.id === id) ?? null;
  }
}
