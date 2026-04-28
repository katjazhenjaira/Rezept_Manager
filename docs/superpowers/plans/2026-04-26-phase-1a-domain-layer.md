# Phase 1a: Domain Layer + Vitest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract pure domain types and functions from `App.tsx` into `src/shared/domain/` and `src/features/cart/services/`, set up Vitest with 100% coverage on all extracted logic.

**Architecture:** Pure TypeScript modules with zero framework dependencies — no React, no Firebase, no DOM. All domain functions are deterministic and unit-testable. App.tsx is NOT touched in this phase; duplication of types is intentional and temporary (resolved in Phase 1b when App.tsx imports from domain layer).

**Tech Stack:** Vitest 3.x, `@vitest/coverage-v8`, TypeScript strict mode, `@` alias → `./src`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `vitest.config.ts` | Create | Vitest config with `@` alias and node environment |
| `package.json` | Modify | Add `vitest`, `@vitest/coverage-v8` dev-deps; add `test`, `test:coverage` scripts |
| `src/shared/domain/types.ts` | Create | All domain types extracted from App.tsx (Recipe, UserProfile, PlannerEntry, Program, etc.) |
| `src/shared/domain/macros.ts` | Create | `sumMacros`, `remainingMacros`, `resolveActiveTargets`, `NutritionTargets` |
| `src/shared/domain/allergies.ts` | Create | `recipeAllergens`, `recipeHasAllergens` |
| `src/features/cart/services/staples.ts` | Create | `BASIC_KEYWORDS`, `isStaple` |
| `src/shared/domain/__tests__/macros.test.ts` | Create | 100% coverage for macros.ts |
| `src/shared/domain/__tests__/allergies.test.ts` | Create | 100% coverage for allergies.ts |
| `src/features/cart/services/__tests__/staples.test.ts` | Create | 100% coverage for staples.ts |

---

## Task 1: Install and configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install Vitest and coverage provider**

```bash
npm install --save-dev vitest @vitest/coverage-v8
```

Expected: Both packages added to `devDependencies` in `package.json`.

- [ ] **Step 2: Add test scripts to `package.json`**

In `package.json`, add to the `"scripts"` block:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/shared/domain/**', 'src/features/cart/services/**'],
      exclude: ['**/__tests__/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Verify Vitest runs with no tests**

```bash
npm run test
```

Expected output: `No test files found, exiting with code 0` or similar (0 errors, 0 failures).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add Vitest with coverage"
```

---

## Task 2: Domain types

**Files:**
- Create: `src/shared/domain/types.ts`

Note: These are extracted from `App.tsx` lines 163–275 and from the `activeNutritionPlan` state type (line 512). `App.tsx` is NOT modified — duplication is intentional. Types will be imported by App.tsx in Phase 1b.

- [ ] **Step 1: Create `src/shared/domain/types.ts`**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/domain/types.ts
git commit -m "feat(domain): add shared domain types"
```

---

## Task 3: macros.ts (TDD)

**Files:**
- Create: `src/shared/domain/__tests__/macros.test.ts`
- Create: `src/shared/domain/macros.ts`

- [ ] **Step 1: Write failing tests**

Create `src/shared/domain/__tests__/macros.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { sumMacros, remainingMacros, resolveActiveTargets } from '../macros';
import type { PlannerEntry, Recipe, UserProfile, ActiveNutritionPlan } from '../types';

const baseProfile: UserProfile = {
  name: 'Test',
  age: 30,
  gender: 'female',
  currentWeight: 65,
  targetWeight: 60,
  targetCalories: 2000,
  targetProteins: 120,
  targetFats: 60,
  targetCarbs: 250,
  waterGoal: 2000,
  allergies: [],
};

const recipeA: Recipe = {
  id: 'r1',
  title: 'Овсянка',
  time: '10 мин',
  servings: 1,
  categories: [],
  ingredients: ['овсянка', 'молоко'],
  steps: [],
  macros: { calories: 300, proteins: 10, fats: 5, carbs: 55 },
  createdAt: '2026-01-01',
};

const recipeB: Recipe = {
  id: 'r2',
  title: 'Омлет',
  time: '15 мин',
  servings: 1,
  categories: [],
  ingredients: ['яйца', 'масло'],
  steps: [],
  macros: { calories: 200, proteins: 15, fats: 14, carbs: 2 },
  createdAt: '2026-01-01',
};

describe('sumMacros', () => {
  it('returns zeros for empty entries', () => {
    expect(sumMacros([], [])).toEqual({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
  });

  it('sums macros for a recipe entry', () => {
    const entry: PlannerEntry = { id: 'e1', date: '2026-01-01', mealType: 'Завтрак', type: 'recipe', recipeId: 'r1' };
    expect(sumMacros([entry], [recipeA, recipeB])).toEqual({ calories: 300, proteins: 10, fats: 5, carbs: 55 });
  });

  it('sums macros for a product entry with inline macros', () => {
    const entry: PlannerEntry = {
      id: 'e2', date: '2026-01-01', mealType: 'Обед', type: 'product',
      macros: { calories: 150, proteins: 5, fats: 3, carbs: 25 },
    };
    expect(sumMacros([entry], [])).toEqual({ calories: 150, proteins: 5, fats: 3, carbs: 25 });
  });

  it('accumulates multiple entries', () => {
    const entries: PlannerEntry[] = [
      { id: 'e1', date: '2026-01-01', mealType: 'Завтрак', type: 'recipe', recipeId: 'r1' },
      { id: 'e2', date: '2026-01-01', mealType: 'Обед', type: 'recipe', recipeId: 'r2' },
    ];
    expect(sumMacros(entries, [recipeA, recipeB])).toEqual({
      calories: 500, proteins: 25, fats: 19, carbs: 57,
    });
  });

  it('ignores recipe entries whose recipeId has no match', () => {
    const entry: PlannerEntry = { id: 'e1', date: '2026-01-01', mealType: 'Завтрак', type: 'recipe', recipeId: 'missing' };
    expect(sumMacros([entry], [recipeA])).toEqual({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
  });

  it('ignores product entries with no macros field', () => {
    const entry: PlannerEntry = { id: 'e1', date: '2026-01-01', mealType: 'Завтрак', type: 'product' };
    expect(sumMacros([entry], [])).toEqual({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
  });
});

describe('remainingMacros', () => {
  it('returns positive difference when targets exceed actual', () => {
    const targets = { calories: 2000, proteins: 120, fats: 60, carbs: 250 };
    const actual = { calories: 500, proteins: 30, fats: 15, carbs: 60 };
    expect(remainingMacros(targets, actual)).toEqual({ calories: 1500, proteins: 90, fats: 45, carbs: 190 });
  });

  it('clamps to zero when actual exceeds targets', () => {
    const targets = { calories: 500, proteins: 30, fats: 15, carbs: 60 };
    const actual = { calories: 600, proteins: 40, fats: 20, carbs: 80 };
    expect(remainingMacros(targets, actual)).toEqual({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
  });

  it('returns zeros when targets equal actual', () => {
    const macros = { calories: 2000, proteins: 120, fats: 60, carbs: 250 };
    expect(remainingMacros(macros, macros)).toEqual({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
  });
});

describe('resolveActiveTargets', () => {
  it('falls back to profile defaults when plan is null', () => {
    const result = resolveActiveTargets(null, baseProfile);
    expect(result).toEqual({
      name: 'По умолчанию (из настроек)',
      calories: 2000,
      proteins: 120,
      fats: 60,
      carbs: 250,
      allowedProducts: [],
      forbiddenProducts: [],
    });
  });

  it('uses plan values when plan is provided', () => {
    const plan: ActiveNutritionPlan = {
      name: 'Похудение',
      calories: 1500,
      proteins: 100,
      fats: 50,
      carbs: 180,
      isCustom: false,
      allowedProducts: ['куриная грудка'],
      forbiddenProducts: ['сахар'],
    };
    const result = resolveActiveTargets(plan, baseProfile);
    expect(result).toEqual({
      name: 'Похудение',
      calories: 1500,
      proteins: 100,
      fats: 50,
      carbs: 180,
      allowedProducts: ['куриная грудка'],
      forbiddenProducts: ['сахар'],
    });
  });

  it('defaults allowedProducts/forbiddenProducts to empty arrays when plan omits them', () => {
    const plan: ActiveNutritionPlan = {
      name: 'Без ограничений',
      calories: 2000,
      proteins: 120,
      fats: 60,
      carbs: 250,
      isCustom: true,
    };
    const result = resolveActiveTargets(plan, baseProfile);
    expect(result.allowedProducts).toEqual([]);
    expect(result.forbiddenProducts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test
```

Expected: FAIL — `Cannot find module '../macros'`

- [ ] **Step 3: Implement `src/shared/domain/macros.ts`**

```typescript
import type { Macros, PlannerEntry, Recipe, UserProfile, ActiveNutritionPlan } from './types';

export type NutritionTargets = {
  name: string;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  allowedProducts: string[];
  forbiddenProducts: string[];
};

export function sumMacros(entries: PlannerEntry[], recipes: Recipe[]): Macros {
  return entries.reduce<Macros>(
    (acc, entry) => {
      const macros =
        entry.type === 'recipe'
          ? recipes.find((r) => r.id === entry.recipeId)?.macros
          : entry.macros;
      if (!macros) return acc;
      return {
        calories: acc.calories + macros.calories,
        proteins: acc.proteins + macros.proteins,
        fats: acc.fats + macros.fats,
        carbs: acc.carbs + macros.carbs,
      };
    },
    { calories: 0, proteins: 0, fats: 0, carbs: 0 }
  );
}

export function remainingMacros(targets: Macros, actual: Macros): Macros {
  return {
    calories: Math.max(0, targets.calories - actual.calories),
    proteins: Math.max(0, targets.proteins - actual.proteins),
    fats: Math.max(0, targets.fats - actual.fats),
    carbs: Math.max(0, targets.carbs - actual.carbs),
  };
}

export function resolveActiveTargets(
  plan: ActiveNutritionPlan | null,
  profile: UserProfile
): NutritionTargets {
  if (plan) {
    return {
      name: plan.name,
      calories: plan.calories,
      proteins: plan.proteins,
      fats: plan.fats,
      carbs: plan.carbs,
      allowedProducts: plan.allowedProducts ?? [],
      forbiddenProducts: plan.forbiddenProducts ?? [],
    };
  }
  return {
    name: 'По умолчанию (из настроек)',
    calories: profile.targetCalories,
    proteins: profile.targetProteins,
    fats: profile.targetFats,
    carbs: profile.targetCarbs,
    allowedProducts: [],
    forbiddenProducts: [],
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test
```

Expected: All tests pass (10 test cases).

- [ ] **Step 5: Check coverage**

```bash
npm run test:coverage
```

Expected: `src/shared/domain/macros.ts` — 100% lines, 100% branches, 100% functions.

- [ ] **Step 6: Commit**

```bash
git add src/shared/domain/macros.ts src/shared/domain/__tests__/macros.test.ts
git commit -m "feat(domain): add sumMacros, remainingMacros, resolveActiveTargets with tests"
```

---

## Task 4: allergies.ts (TDD)

**Files:**
- Create: `src/shared/domain/__tests__/allergies.test.ts`
- Create: `src/shared/domain/allergies.ts`

- [ ] **Step 1: Write failing tests**

Create `src/shared/domain/__tests__/allergies.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { recipeAllergens, recipeHasAllergens } from '../allergies';
import type { Recipe } from '../types';

const makeRecipe = (ingredients: string[]): Recipe => ({
  id: 'r1',
  title: 'Тест',
  time: '10 мин',
  servings: 1,
  categories: [],
  ingredients,
  steps: [],
  macros: { calories: 0, proteins: 0, fats: 0, carbs: 0 },
  createdAt: '2026-01-01',
});

describe('recipeAllergens', () => {
  it('returns empty array when allergies list is empty', () => {
    const recipe = makeRecipe(['яйца', 'молоко', 'мука']);
    expect(recipeAllergens(recipe, [])).toEqual([]);
  });

  it('returns empty array when no ingredient matches any allergy', () => {
    const recipe = makeRecipe(['куриная грудка', 'рис', 'перец']);
    expect(recipeAllergens(recipe, ['Орехи', 'Лактоза'])).toEqual([]);
  });

  it('returns matching allergen when ingredient contains allergy substring', () => {
    const recipe = makeRecipe(['грецкие орехи', 'сахар', 'масло']);
    expect(recipeAllergens(recipe, ['Орехи'])).toEqual(['Орехи']);
  });

  it('is case-insensitive on both allergy and ingredient', () => {
    const recipe = makeRecipe(['Куриное ЯЙЦО', 'мука']);
    expect(recipeAllergens(recipe, ['яйца'])).toEqual(['яйца']);
  });

  it('returns multiple matching allergens', () => {
    const recipe = makeRecipe(['сыр молочный', 'яйца свежие']);
    expect(recipeAllergens(recipe, ['молоко', 'яйца'])).toEqual(['молоко', 'яйца']);
  });

  it('returns allergen when ingredient exactly equals allergy (case-insensitive)', () => {
    const recipe = makeRecipe(['молоко', 'сахар']);
    expect(recipeAllergens(recipe, ['Молоко'])).toEqual(['Молоко']);
  });
});

describe('recipeHasAllergens', () => {
  it('returns false when no allergens match', () => {
    const recipe = makeRecipe(['куриная грудка', 'рис']);
    expect(recipeHasAllergens(recipe, ['Орехи', 'Лактоза'])).toBe(false);
  });

  it('returns true when at least one allergen matches', () => {
    const recipe = makeRecipe(['грецкие орехи', 'мёд']);
    expect(recipeHasAllergens(recipe, ['Орехи'])).toBe(true);
  });

  it('returns false for empty allergies list', () => {
    const recipe = makeRecipe(['молоко', 'яйца']);
    expect(recipeHasAllergens(recipe, [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test
```

Expected: FAIL — `Cannot find module '../allergies'`

- [ ] **Step 3: Implement `src/shared/domain/allergies.ts`**

```typescript
import type { Recipe } from './types';

export function recipeAllergens(recipe: Recipe, allergies: string[]): string[] {
  return allergies.filter((allergy) =>
    recipe.ingredients.some((ing) =>
      ing.toLowerCase().includes(allergy.toLowerCase())
    )
  );
}

export function recipeHasAllergens(recipe: Recipe, allergies: string[]): boolean {
  return recipeAllergens(recipe, allergies).length > 0;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test
```

Expected: All tests pass.

- [ ] **Step 5: Check coverage**

```bash
npm run test:coverage
```

Expected: `src/shared/domain/allergies.ts` — 100% lines, 100% branches, 100% functions.

- [ ] **Step 6: Commit**

```bash
git add src/shared/domain/allergies.ts src/shared/domain/__tests__/allergies.test.ts
git commit -m "feat(domain): add recipeAllergens, recipeHasAllergens with tests"
```

---

## Task 5: staples.ts (TDD)

**Files:**
- Create: `src/features/cart/services/__tests__/staples.test.ts`
- Create: `src/features/cart/services/staples.ts`

Note: `BASIC_KEYWORDS` is defined inline in App.tsx at lines 593 and 1946 (duplicated). This task eliminates both duplicates. App.tsx will import from `staples.ts` in Phase 1b.

- [ ] **Step 1: Write failing tests**

Create `src/features/cart/services/__tests__/staples.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isStaple, BASIC_KEYWORDS } from '../staples';

describe('BASIC_KEYWORDS', () => {
  it('contains expected staple keywords', () => {
    expect(BASIC_KEYWORDS).toContain('соль');
    expect(BASIC_KEYWORDS).toContain('сахар');
    expect(BASIC_KEYWORDS).toContain('масло');
  });

  it('has 12 entries', () => {
    expect(BASIC_KEYWORDS).toHaveLength(12);
  });
});

describe('isStaple', () => {
  it('returns true for "Соль морская"', () => {
    expect(isStaple('Соль морская')).toBe(true);
  });

  it('returns true for "Оливковое масло" (case-insensitive)', () => {
    expect(isStaple('Оливковое масло')).toBe(true);
  });

  it('returns true for "ПЕРЕЦ черный"', () => {
    expect(isStaple('ПЕРЕЦ черный')).toBe(true);
  });

  it('returns true for "чесночный соус" (contains "чеснок")', () => {
    expect(isStaple('чесночный соус')).toBe(true);
  });

  it('returns false for "Куриная грудка"', () => {
    expect(isStaple('Куриная грудка')).toBe(false);
  });

  it('returns false for "Говядина"', () => {
    expect(isStaple('Говядина')).toBe(false);
  });

  it('returns false for "Брокколи"', () => {
    expect(isStaple('Брокколи')).toBe(false);
  });

  it('returns true for "питьевая вода"', () => {
    expect(isStaple('питьевая вода')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test
```

Expected: FAIL — `Cannot find module '../staples'`

- [ ] **Step 3: Implement `src/features/cart/services/staples.ts`**

```typescript
export const BASIC_KEYWORDS = [
  'соль', 'сахар', 'перец', 'лук', 'чеснок', 'масло',
  'мука', 'сода', 'уксус', 'вода', 'специи', 'приправа',
] as const;

export function isStaple(name: string): boolean {
  const lower = name.toLowerCase();
  return BASIC_KEYWORDS.some((k) => lower.includes(k));
}
```

- [ ] **Step 4: Run all tests to confirm they pass**

```bash
npm run test
```

Expected: All tests pass (macros + allergies + staples).

- [ ] **Step 5: Check full coverage**

```bash
npm run test:coverage
```

Expected output (approximate):
```
 % Stmts | % Branch | % Funcs | % Lines | File
---------|----------|---------|---------|-------------------------------------------
     100 |      100 |     100 |     100 | src/shared/domain/allergies.ts
     100 |      100 |     100 |     100 | src/shared/domain/macros.ts
     100 |      100 |     100 |     100 | src/features/cart/services/staples.ts
```

- [ ] **Step 6: Run lint to confirm TypeScript is clean**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/cart/services/staples.ts src/features/cart/services/__tests__/staples.test.ts
git commit -m "feat(domain): add isStaple, BASIC_KEYWORDS with tests"
```

---

## Self-Review Checklist

- [x] Vitest setup — Task 1
- [x] `src/shared/domain/types.ts` with all domain types — Task 2
- [x] `src/shared/domain/macros.ts` with `sumMacros`, `remainingMacros`, `resolveActiveTargets` — Task 3
- [x] `src/shared/domain/allergies.ts` with `recipeAllergens`, `recipeHasAllergens` — Task 4
- [x] `src/features/cart/services/staples.ts` with `BASIC_KEYWORDS`, `isStaple` — Task 5
- [x] 100% test coverage on all extracted files — covered in Tasks 3–5
- [x] `npm run lint` green after each task — step in each task
- [x] No placeholders — all code is complete
- [x] Type consistency — `Macros`, `PlannerEntry`, `Recipe`, `UserProfile`, `ActiveNutritionPlan` all defined in `types.ts` and imported consistently across macros.ts and allergies.ts
- [x] App.tsx NOT touched — duplication intentional per architecture note
