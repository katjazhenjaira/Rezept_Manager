import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, getDoc,
} from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { Program } from '@/shared/domain/types';
import type { ProgramsRepository } from '@/services/ProgramsRepository';
import { timestampToISO, type TimestampLike } from './converters';

function fromFirestore(id: string, data: Record<string, unknown>): Program {
  return {
    id,
    name: data['name'] as string,
    description: data['description'] as string,
    creator: data['creator'] as string,
    link: data['link'] as string,
    recipeIds: (data['recipeIds'] as string[]) ?? [],
    createdAt: timestampToISO(data['createdAt'] as TimestampLike | string | null | undefined),
    image: data['image'] as string | undefined,
    pdfUrl: data['pdfUrl'] as string | undefined,
    subfolders: data['subfolders'] as Program['subfolders'],
    resources: data['resources'] as Program['resources'],
    targetCalories: data['targetCalories'] as number | undefined,
    targetProteins: data['targetProteins'] as number | undefined,
    targetFats: data['targetFats'] as number | undefined,
    targetCarbs: data['targetCarbs'] as number | undefined,
    allowedProducts: data['allowedProducts'] as string[] | undefined,
    forbiddenProducts: data['forbiddenProducts'] as string[] | undefined,
  };
}

export class FirestoreProgramsRepository implements ProgramsRepository {
  subscribeAll(callback: (programs: Program[]) => void): () => void {
    return onSnapshot(query(collection(db, 'programs')), snapshot => {
      const programs: Program[] = [];
      snapshot.forEach(d => programs.push(fromFirestore(d.id, d.data())));
      callback(programs);
    });
  }

  async add(data: Omit<Program, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'programs'), data);
    return ref.id;
  }

  async update(id: string, data: Partial<Omit<Program, 'id'>>): Promise<void> {
    await updateDoc(doc(db, 'programs', id), data);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'programs', id));
  }

  async getById(id: string): Promise<Program | null> {
    const snap = await getDoc(doc(db, 'programs', id));
    if (!snap.exists()) return null;
    return fromFirestore(snap.id, snap.data());
  }
}
