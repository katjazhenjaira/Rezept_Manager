import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { UserProfile } from '@/shared/domain/types';
import type { UserProfileRepository } from '@/services/UserProfileRepository';
import { requiredNumber, requiredString, stringArray } from './converters';
import { DEFAULT_MEAL_TYPES } from '@/shared/domain/defaults';

function fromFirestore(data: Record<string, unknown>): UserProfile {
  return {
    name: requiredString(data['name'], 'name'),
    age: requiredNumber(data['age'], 'age'),
    gender: requiredString(data['gender'], 'gender') as UserProfile['gender'],
    currentWeight: requiredNumber(data['currentWeight'], 'currentWeight'),
    targetWeight: requiredNumber(data['targetWeight'], 'targetWeight'),
    targetCalories: requiredNumber(data['targetCalories'], 'targetCalories'),
    targetProteins: requiredNumber(data['targetProteins'], 'targetProteins'),
    targetFats: requiredNumber(data['targetFats'], 'targetFats'),
    targetCarbs: requiredNumber(data['targetCarbs'], 'targetCarbs'),
    waterGoal: requiredNumber(data['waterGoal'], 'waterGoal'),
    allergies: stringArray(data['allergies'], 'allergies', []),
    mealTypes: stringArray(data['mealTypes'], 'mealTypes', DEFAULT_MEAL_TYPES),
  };
}

export class FirestoreUserProfileRepository implements UserProfileRepository {
  constructor(private readonly uid: string) {}

  subscribe(
    callback: (profile: UserProfile | null) => void,
    onError?: (error: Error) => void,
  ): () => void {
    return onSnapshot(
      doc(db, 'userProfiles', this.uid),
      (snap) => {
        callback(snap.exists() ? fromFirestore(snap.data()) : null);
      },
      (error) => {
        console.error('FirestoreUserProfileRepository.subscribe failed:', error);
        onError?.(error);
      },
    );
  }

  async save(profile: UserProfile): Promise<void> {
    await setDoc(doc(db, 'userProfiles', this.uid), profile);
  }
}
