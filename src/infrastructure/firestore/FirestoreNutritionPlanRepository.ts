import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { NutritionPlanRepository } from '@/services/NutritionPlanRepository';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

const planRef = () => doc(db, 'settings', 'plan');

export class FirestoreNutritionPlanRepository implements NutritionPlanRepository {
  async get(): Promise<ActiveNutritionPlan | null> {
    const snap = await getDoc(planRef());
    return snap.exists() ? (snap.data() as ActiveNutritionPlan) : null;
  }

  async set(plan: ActiveNutritionPlan | null): Promise<void> {
    if (plan === null) {
      await deleteDoc(planRef());
    } else {
      await setDoc(planRef(), plan);
    }
  }
}
