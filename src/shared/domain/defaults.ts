import type { UserProfile } from './types';

export const DEFAULT_MEAL_TYPES = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  age: 30,
  gender: 'female',
  currentWeight: 65,
  targetWeight: 60,
  targetCalories: 1800,
  targetProteins: 100,
  targetFats: 60,
  targetCarbs: 200,
  waterGoal: 2000,
  allergies: [],
  mealTypes: DEFAULT_MEAL_TYPES,
};
