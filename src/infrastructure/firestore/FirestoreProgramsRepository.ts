import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, getDoc, where,
} from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import { resolveImageField } from '@/infrastructure/firebaseStorage';
import type { Program } from '@/shared/domain/types';
import type { ProgramsRepository } from '@/services/ProgramsRepository';
import { timestampToISO, type TimestampLike } from './converters';

async function resolveSubfolderImages(
  uid: string,
  subfolders: Program['subfolders']
): Promise<Program['subfolders']> {
  if (!subfolders) return subfolders;
  return Promise.all(
    subfolders.map(async (sf) => ({
      ...sf,
      image: await resolveImageField(uid, 'subfolderImages', sf.image),
    }))
  );
}

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
  constructor(private readonly uid: string) {}

  subscribeAll(callback: (programs: Program[]) => void, onError?: (error: Error) => void): () => void {
    return onSnapshot(
      query(collection(db, 'programs'), where('userId', '==', this.uid)),
      snapshot => {
        const programs: Program[] = [];
        snapshot.forEach(d => programs.push(fromFirestore(d.id, d.data())));
        callback(programs);
      },
      error => {
        console.error('FirestoreProgramsRepository.subscribeAll failed:', error);
        onError?.(error);
      }
    );
  }

  async add(data: Omit<Program, 'id'>): Promise<string> {
    const image = await resolveImageField(this.uid, 'programImages', data.image);
    const subfolders = await resolveSubfolderImages(this.uid, data.subfolders);
    const ref = await addDoc(collection(db, 'programs'), {
      ...data, image, subfolders, userId: this.uid,
    });
    return ref.id;
  }

  async update(id: string, data: Partial<Omit<Program, 'id'>>): Promise<void> {
    const payload = { ...data };
    if ('image' in data) {
      payload.image = await resolveImageField(this.uid, 'programImages', data.image);
    }
    if ('subfolders' in data) {
      payload.subfolders = await resolveSubfolderImages(this.uid, data.subfolders);
    }
    await updateDoc(doc(db, 'programs', id), payload);
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
