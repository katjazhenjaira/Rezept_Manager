import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query, where,
} from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { PlannerEntry } from '@/shared/domain/types';
import type { PlannerRepository } from '@/services/PlannerRepository';
import { requiredString } from './converters';

function fromFirestore(id: string, data: Record<string, unknown>): PlannerEntry {
  return {
    id,
    date: requiredString(data['date'], 'date'),
    mealType: requiredString(data['mealType'], 'mealType'),
    type: requiredString(data['type'], 'type') as PlannerEntry['type'],
    recipeId: data['recipeId'] as string | undefined,
    productName: data['productName'] as string | undefined,
    amount: data['amount'] as string | undefined,
    macros: data['macros'] as PlannerEntry['macros'],
  };
}

export class FirestorePlannerRepository implements PlannerRepository {
  constructor(private readonly uid: string) {}

  subscribeAll(callback: (entries: PlannerEntry[]) => void, onError?: (error: Error) => void): () => void {
    return onSnapshot(
      query(collection(db, 'planner'), where('userId', '==', this.uid)),
      snapshot => {
        const entries: PlannerEntry[] = [];
        snapshot.forEach(d => entries.push(fromFirestore(d.id, d.data())));
        callback(entries);
      },
      error => {
        console.error('FirestorePlannerRepository.subscribeAll failed:', error);
        onError?.(error);
      }
    );
  }

  async add(data: Omit<PlannerEntry, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'planner'), { ...data, userId: this.uid });
    return ref.id;
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'planner', id));
  }
}
