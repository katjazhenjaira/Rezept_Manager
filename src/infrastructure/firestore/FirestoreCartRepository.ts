import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, getDocs,
} from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { CartItem } from '@/shared/domain/types';
import type { CartRepository } from '@/services/CartRepository';
import { timestampToISO, type TimestampLike } from './converters';

function fromFirestore(id: string, data: Record<string, unknown>): CartItem {
  return {
    id,
    name: data['name'] as string,
    amount: data['amount'] as string,
    sourceDishes: (data['sourceDishes'] as string[]) ?? [],
    checked: data['checked'] as boolean,
    isBasic: data['isBasic'] as boolean | undefined,
    createdAt: timestampToISO(data['createdAt'] as TimestampLike | string | null | undefined),
  };
}

export class FirestoreCartRepository implements CartRepository {
  subscribeAll(callback: (items: CartItem[]) => void): () => void {
    return onSnapshot(query(collection(db, 'cart')), snap => {
      const items: CartItem[] = [];
      snap.forEach(d => items.push(fromFirestore(d.id, d.data())));
      callback(
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    });
  }

  async add(data: Omit<CartItem, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'cart'), data);
    return ref.id;
  }

  async update(id: string, data: Partial<Omit<CartItem, 'id'>>): Promise<void> {
    await updateDoc(doc(db, 'cart', id), data);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'cart', id));
  }

  async deleteAll(): Promise<void> {
    const snap = await getDocs(query(collection(db, 'cart')));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'cart', d.id))));
  }
}
