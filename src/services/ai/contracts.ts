// Shared DTO для AI-proxy: импортируется клиентом (src/) и воркером (worker/).
// Подробные типы уточнятся в слайсе 2 при порте вызовов из App.tsx.

export type Macros = {
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
};

export type AllergyList = string[];

// --- Импорт рецептов ---

export type ImportedRecipe = {
  title: string;
  author?: string;
  sourceUrl?: string;
  ingredients: string[];
  steps: string[];
  time: string;
  categories: string[];
  servings: number;
  macros: Macros;
  dishImage?: string;
  pageNumber?: number;
  dishBoundingBox?: { ymin: number; xmin: number; ymax: number; xmax: number };
};

export type ImportFromUrlRequest = {
  url: string;
  availableCategories: string[];
};
export type ImportFromUrlResponse = { recipe: ImportedRecipe };

export type ImportFromPdfRequest = {
  pdfBase64?: string;
  pdfText?: string; // large PDFs: text extracted on client via pdfjs-dist
  availableCategories: string[];
};
export type ImportFromPdfResponse = { recipes: ImportedRecipe[] };

export type ImportFromPhotoRequest = {
  images: { base64: string; mimeType: string }[];
  availableCategories: string[];
};
export type ImportFromPhotoResponse = { recipe: ImportedRecipe };

// --- Картинка блюда ---

export type GenerateImageRequest = {
  title: string;
  ingredients: string[];
};
export type GenerateImageResponse = { imageDataUri: string };

// --- КБЖУ ---

export type CalculateKbzhuRequest = {
  ingredients: string;
};
export type CalculateKbzhuResponse = Macros;

// --- Добор КБЖУ на день ---

export type FillRemainingRequest = {
  remaining: Macros;
  planName: string;
  allergies: AllergyList;
  activeProgramRules?: {
    allowedProducts?: string[];
    forbiddenProducts?: string[];
  };
  userRecipes: { id: string; title: string; macros: Macros }[];
};
export type FillRemainingOption = {
  id: string;
  type: "recipe" | "product";
  recipeId?: string;
  description: string;
  macros: Macros;
};
export type FillRemainingResponse = { options: FillRemainingOption[]; reason: string };

export type AiErrorResponse = { error: string };
