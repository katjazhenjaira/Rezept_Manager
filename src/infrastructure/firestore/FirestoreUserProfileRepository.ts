import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { UserProfile } from '@/shared/domain/types';
import type { UserProfileRepository } from '@/services/UserProfileRepository';

export class FirestoreUserProfileRepository implements UserProfileRepository {
  subscribe(callback: (profile: UserProfile | null) => void): () => void {
    return onSnapshot(doc(db, 'settings', 'profile'), snap => {
      callback(snap.exists() ? (snap.data() as UserProfile) : null);
    });
  }

  async save(profile: UserProfile): Promise<void> {
    await setDoc(doc(db, 'settings', 'profile'), profile);
  }
}
