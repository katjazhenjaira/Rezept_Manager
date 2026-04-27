import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { NutritionPlanRepository } from '@/services/NutritionPlanRepository';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

const planRef = () => doc(db, 'settings', 'plan');

export class FirestoreNutritionPlanRepository implements NutritionPlanRepository {
  async get(): Promise<ActiveNutritionPlan | null> {
    const snap = await getDoc(planRef());
    if (!snap.exists()) return null;
    const data = snap.data() as Omit<
      ActiveNutritionPlan,
      'allowedProducts' | 'forbiddenProducts'
    > & {
      allowedProducts?: string[];
      forbiddenProducts?: string[];
    };
    return {
      ...data,
      allowedProducts: data.allowedProducts ?? [],
      forbiddenProducts: data.forbiddenProducts ?? [],
    };
  }

  async set(plan: ActiveNutritionPlan | null): Promise<void> {
    if (plan === null) {
      await deleteDoc(planRef());
    } else {
      await setDoc(planRef(), plan);
    }
  }
}
