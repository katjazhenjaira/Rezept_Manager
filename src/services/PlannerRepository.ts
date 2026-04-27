import type { PlannerEntry } from '@/shared/domain/types';

export interface PlannerRepository {
  subscribeAll(callback: (entries: PlannerEntry[]) => void): () => void;
  add(data: Omit<PlannerEntry, 'id'>): Promise<string>;
  delete(id: string): Promise<void>;
}
