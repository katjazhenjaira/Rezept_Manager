import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, getDoc, where,
} from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import { resolveImageField } from '@/infrastructure/firebaseStorage';
import type { Recipe } from '@/shared/domain/types';
import type { RecipesRepository } from '@/services/RecipesRepository';
import { timestampToISO, requiredString, requiredNumber, requiredMacros, type TimestampLike } from './converters';

function fromFirestore(id: string, data: Record<string, unknown>): Recipe {
  return {
    id,
    title: requiredString(data['title'], 'title'),
    image: data['image'] as string | undefined,
    sourceUrl: data['sourceUrl'] as string | undefined,
    author: data['author'] as string | undefined,
    time: requiredString(data['time'], 'time'),
    servings: requiredNumber(data['servings'], 'servings'),
    categories: (data['categories'] as string[]) ?? [],
    ingredients: (data['ingredients'] as string[]) ?? [],
    steps: (data['steps'] as string[]) ?? [],
    macros: requiredMacros(data['macros'], 'macros'),
    substitutions: data['substitutions'] as string | undefined,
    isFavorite: data['isFavorite'] as boolean | undefined,
    createdAt: timestampToISO(data['createdAt'] as TimestampLike | string | null | undefined),
  };
}

export class FirestoreRecipesRepository implements RecipesRepository {
  constructor(private readonly uid: string) {}

  subscribeAll(callback: (recipes: Recipe[]) => void, onError?: (error: Error) => void): () => void {
    return onSnapshot(
      query(collection(db, 'recipes'), where('userId', '==', this.uid)),
      snapshot => {
        const recipes: Recipe[] = [];
        snapshot.forEach(d => recipes.push(fromFirestore(d.id, d.data())));
        callback(recipes);
      },
      error => {
        console.error('FirestoreRecipesRepository.subscribeAll failed:', error);
        onError?.(error);
      }
    );
  }

  async add(data: Omit<Recipe, 'id'>): Promise<string> {
    const image = await resolveImageField(this.uid, 'recipeImages', data.image);
    const ref = await addDoc(collection(db, 'recipes'), { ...data, image, userId: this.uid });
    return ref.id;
  }

  async update(id: string, data: Partial<Omit<Recipe, 'id'>>): Promise<void> {
    const payload = { ...data };
    if ('image' in data) {
      payload.image = await resolveImageField(this.uid, 'recipeImages', data.image);
    }
    await updateDoc(doc(db, 'recipes', id), payload);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'recipes', id));
  }

  async getById(id: string): Promise<Recipe | null> {
    const snap = await getDoc(doc(db, 'recipes', id));
    if (!snap.exists()) return null;
    return fromFirestore(snap.id, snap.data());
  }
}
