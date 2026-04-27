import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query,
} from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { PlannerEntry } from '@/shared/domain/types';
import type { PlannerRepository } from '@/services/PlannerRepository';

function fromFirestore(id: string, data: Record<string, unknown>): PlannerEntry {
  return {
    id,
    date: data['date'] as string,
    mealType: data['mealType'] as string,
    type: data['type'] as 'recipe' | 'product',
    recipeId: data['recipeId'] as string | undefined,
    productName: data['productName'] as string | undefined,
    amount: data['amount'] as string | undefined,
    macros: data['macros'] as PlannerEntry['macros'],
  };
}

export class FirestorePlannerRepository implements PlannerRepository {
  subscribeAll(callback: (entries: PlannerEntry[]) => void): () => void {
    return onSnapshot(query(collection(db, 'planner')), snapshot => {
      const entries: PlannerEntry[] = [];
      snapshot.forEach(d => entries.push(fromFirestore(d.id, d.data())));
      callback(entries);
    });
  }

  async add(data: Omit<PlannerEntry, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'planner'), data);
    return ref.id;
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'planner', id));
  }
}
