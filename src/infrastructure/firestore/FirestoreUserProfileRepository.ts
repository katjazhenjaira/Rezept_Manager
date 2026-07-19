import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { UserProfile } from '@/shared/domain/types';
import type { UserProfileRepository } from '@/services/UserProfileRepository';

export class FirestoreUserProfileRepository implements UserProfileRepository {
  constructor(private readonly uid: string) {}

  subscribe(callback: (profile: UserProfile | null) => void, onError?: (error: Error) => void): () => void {
    return onSnapshot(
      doc(db, 'userProfiles', this.uid),
      snap => {
        callback(snap.exists() ? (snap.data() as UserProfile) : null);
      },
      error => {
        console.error('FirestoreUserProfileRepository.subscribe failed:', error);
        onError?.(error);
      }
    );
  }

  async save(profile: UserProfile): Promise<void> {
    await setDoc(doc(db, 'userProfiles', this.uid), profile);
  }
}
