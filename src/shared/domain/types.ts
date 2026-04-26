export type Tab = 'recipes' | 'planner' | 'cart' | 'tracker' | 'programs';

export type Macros = {
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
};

export interface Recipe {
  id: string;
  title: string;
  image?: string;
  sourceUrl?: string;
  author?: string;
  time: string;
  servings: number;
  categories: string[];
  ingredients: string[];
  steps: string[];
  macros: Macros;
  substitutions?: string;
  isFavorite?: boolean;
  createdAt: string;
}

export type UserProfile = {
  name: string;
  age: number;
  gender: 'male' | 'female';
  currentWeight: number;
  targetWeight: number;
  targetCalories: number;
  targetProteins: number;
  targetFats: number;
  targetCarbs: number;
  waterGoal: number;
  allergies: string[];
};

export type RecipeView = 'all' | 'favorites';

export type Resource = {
  id: string;
  type: 'pdf' | 'link';
  url: string;
  title: string;
  description?: string;
};

export type Subfolder = {
  id: string;
  name: string;
  description: string;
  image?: string;
  recipeIds: string[];
  pdfUrl?: string;
  link?: string;
  resources?: Resource[];
  targetCalories?: number;
  targetProteins?: number;
  targetFats?: number;
  targetCarbs?: number;
  allowedProducts?: string[];
  forbiddenProducts?: string[];
};

export type Program = {
  id: string;
  name: string;
  description: string;
  creator: string;
  link: string;
  recipeIds: string[];
  createdAt: string;
  image?: string;
  pdfUrl?: string;
  subfolders?: Subfolder[];
  resources?: Resource[];
  targetCalories?: number;
  targetProteins?: number;
  targetFats?: number;
  targetCarbs?: number;
  allowedProducts?: string[];
  forbiddenProducts?: string[];
};

export type PlannerEntry = {
  id: string;
  date: string;
  mealType: string;
  type: 'recipe' | 'product';
  recipeId?: string;
  productName?: string;
  amount?: string;
  macros?: Macros;
};

export type PlannerViewScale = 'day' | 'week' | 'month';
export type PlannerViewMode = 'calendar' | 'list';

export interface CartItem {
  id: string;
  name: string;
  amount: string;
  sourceDishes: string[];
  checked: boolean;
  isBasic?: boolean;
  createdAt: string;
}

export type ActiveNutritionPlan = {
  name: string;
  subfolderName?: string;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  isCustom: boolean;
  programId?: string;
  subfolderId?: string;
  allowedProducts?: string[];
  forbiddenProducts?: string[];
};
