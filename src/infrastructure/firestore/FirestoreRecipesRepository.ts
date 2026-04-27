import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, getDoc,
} from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { Recipe } from '@/shared/domain/types';
import type { RecipesRepository } from '@/services/RecipesRepository';
import { timestampToISO, type TimestampLike } from './converters';

function fromFirestore(id: string, data: Record<string, unknown>): Recipe {
  return {
    id,
    title: data['title'] as string,
    image: data['image'] as string | undefined,
    sourceUrl: data['sourceUrl'] as string | undefined,
    author: data['author'] as string | undefined,
    time: data['time'] as string,
    servings: data['servings'] as number,
    categories: (data['categories'] as string[]) ?? [],
    ingredients: (data['ingredients'] as string[]) ?? [],
    steps: (data['steps'] as string[]) ?? [],
    macros: data['macros'] as Recipe['macros'],
    substitutions: data['substitutions'] as string | undefined,
    isFavorite: data['isFavorite'] as boolean | undefined,
    createdAt: timestampToISO(data['createdAt'] as TimestampLike | string | null | undefined),
  };
}

export class FirestoreRecipesRepository implements RecipesRepository {
  subscribeAll(callback: (recipes: Recipe[]) => void): () => void {
    return onSnapshot(query(collection(db, 'recipes')), snapshot => {
      const recipes: Recipe[] = [];
      snapshot.forEach(d => recipes.push(fromFirestore(d.id, d.data())));
      callback(recipes);
    });
  }

  async add(data: Omit<Recipe, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'recipes'), data);
    return ref.id;
  }

  async update(id: string, data: Partial<Omit<Recipe, 'id'>>): Promise<void> {
    await updateDoc(doc(db, 'recipes', id), data);
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
