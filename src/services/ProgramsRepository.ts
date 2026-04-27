import type { Program } from '@/shared/domain/types';

export interface ProgramsRepository {
  subscribeAll(callback: (programs: Program[]) => void): () => void;
  add(data: Omit<Program, 'id'>): Promise<string>;
  update(id: string, data: Partial<Omit<Program, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Program | null>;
}
