import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { NutritionPlanRepository } from '@/services/NutritionPlanRepository';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

export class FirestoreNutritionPlanRepository implements NutritionPlanRepository {
  constructor(private readonly uid: string) {}

  private get ref() {
    return doc(db, 'nutritionPlans', this.uid);
  }

  async get(): Promise<ActiveNutritionPlan | null> {
    const snap = await getDoc(this.ref);
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
      await deleteDoc(this.ref);
    } else {
      await setDoc(this.ref, plan);
    }
  }
}
