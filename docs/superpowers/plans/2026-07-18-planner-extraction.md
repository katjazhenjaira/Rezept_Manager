# Planner Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Planner tab from `App.tsx` into `src/features/planner/PlannerView.tsx`, eliminating the duplicate Firestore `planner` subscription and reducing App.tsx by ~40%.

**Architecture:** Single new file `PlannerView.tsx` reads `plannerEntries` internally from `DataContext` and receives `mealTypes` + `checkedEntries` as controlled props (shared with Tracker). All four view render functions remain as closures inside the component — no sub-components added.

**Tech Stack:** React 19, TypeScript strict, Firebase Firestore, date-fns, lucide-react, motion/react, Tailwind CSS v4.

---

## File Map

| Action | Path | Description |
|--------|------|-------------|
| Create | `src/features/planner/PlannerView.tsx` | New component (~900 lines) |
| Create | `src/features/planner/__tests__/PlannerView.test.tsx` | Smoke render test |
| Modify | `src/App.tsx` | Remove planner state/handlers/JSX; wire PlannerView |

---

## Deviations from design spec

The design spec (2026-04-30) needs three corrections found during code analysis:

1. **`mealTypes` is shared with Tracker** (used at App.tsx:1586 in `renderTracker`). Stays in App.tsx; passed as controlled props `mealTypes` + `onMealTypesChange`.
2. **`onAddProductsToCart` is not called by planner code** — the shopping list button writes to Firestore directly. Replaced with `onNavigateToCart: () => void` (for `setActiveTab('cart')` after adding to cart).
3. **`customPlanForm` is Tracker state**, not planner state (used in the Program Selection Modal at lines 2283+). Stays in App.tsx.
4. **Extra state found**: `activeAddDropdown` (App.tsx:333) is planner-only and moves to PlannerView.

---

## Task 1: Write failing smoke test

**Files:**
- Create: `src/features/planner/__tests__/PlannerView.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DataContext } from '@/app/providers/DataContext';
import type { UserProfile, ActiveNutritionPlan } from '@/shared/domain/types';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'test-id' }),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn(),
}));

vi.mock('@/infrastructure/firebaseApp', () => ({ db: {} }));

const mockProfile: UserProfile = {
  name: 'Тест',
  age: 30,
  gender: 'female',
  currentWeight: 60,
  targetWeight: 55,
  targetCalories: 1800,
  targetProteins: 100,
  targetFats: 60,
  targetCarbs: 200,
  waterGoal: 2000,
  allergies: [],
};

const emptyData = { recipes: [], plannerEntries: [], cartItems: [], programs: [] };

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <DataContext.Provider value={emptyData}>
      {children}
    </DataContext.Provider>
  );
}

// Import will fail until PlannerView.tsx exists — that is the expected failure mode.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PlannerView: any;
try {
  PlannerView = (await import('../PlannerView')).PlannerView;
} catch {
  PlannerView = null;
}

describe('PlannerView', () => {
  it('renders without crashing', () => {
    if (!PlannerView) {
      expect(true).toBe(false); // force fail until file is created
      return;
    }
    render(
      <Wrapper>
        <PlannerView
          recipes={[]}
          userProfile={mockProfile}
          activeNutritionPlan={null as ActiveNutritionPlan | null}
          checkedEntries={[]}
          onCheckedEntriesChange={vi.fn()}
          onSelectRecipe={vi.fn()}
          onNavigateToCart={vi.fn()}
          mealTypes={['Завтрак', 'Обед', 'Ужин', 'Перекус']}
          onMealTypesChange={vi.fn()}
        />
      </Wrapper>
    );
    expect(screen.getByText(/составь твой/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager
npx vitest run src/features/planner/__tests__/PlannerView.test.tsx
```

Expected: 1 test fails with "expect(true).toBe(false)" (PlannerView file not yet created).

---

## Task 2: Create PlannerView.tsx

**Files:**
- Create: `src/features/planner/PlannerView.tsx`

This task moves code from App.tsx with three adaptations:
1. All references to `setSelectedRecipe` → `onSelectRecipe`
2. All references to `setActiveTab('cart')` → `onNavigateToCart()`
3. `plannerEntries` comes from `useData()` not props
4. `mealTypes` / `setMealTypes` come from props

- [ ] **Step 1: Create the file with imports, type, and state**

```tsx
import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  ShoppingCart,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  List,
  ChefHat,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import { isStaple } from '@/features/cart/services/staples';
import {
  format,
  addDays,
  subDays,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isToday,
  parseISO,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { useData } from '@/app/providers/DataContext';
import type {
  Recipe,
  UserProfile,
  ActiveNutritionPlan,
  PlannerViewScale,
  PlannerViewMode,
} from '@/shared/domain/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type PlannerViewProps = {
  recipes: Recipe[];
  userProfile: UserProfile;
  activeNutritionPlan: ActiveNutritionPlan | null;
  checkedEntries: string[];
  onCheckedEntriesChange: (entries: string[]) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onNavigateToCart: () => void;
  mealTypes: string[];
  onMealTypesChange: (types: string[]) => void;
};

export function PlannerView({
  recipes,
  userProfile,
  activeNutritionPlan: _activeNutritionPlan,
  checkedEntries: _checkedEntries,
  onCheckedEntriesChange: _onCheckedEntriesChange,
  onSelectRecipe,
  onNavigateToCart,
  mealTypes,
  onMealTypesChange,
}: PlannerViewProps) {
  const { plannerEntries } = useData();

  const [plannerViewScale, setPlannerViewScale] = useState<PlannerViewScale>('week');
  const [plannerViewMode, setPlannerViewMode] = useState<PlannerViewMode>('calendar');
  const [selectedPlannerDate, setSelectedPlannerDate] = useState(new Date());
  const [isRecipePickerOpen, setIsRecipePickerOpen] = useState(false);
  const [pickingMealInfo, setPickingMealInfo] = useState<{ date: string; mealType: string } | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [activeAddDropdown, setActiveAddDropdown] = useState<string | null>(null);
  const [productFormData, setProductFormData] = useState({
    name: '',
    amount: '',
    calories: 0,
    proteins: 0,
    fats: 0,
    carbs: 0,
  });
```

- [ ] **Step 2: Add the three handlers (copy from App.tsx, adapt)**

Continue the file after the state declarations:

```tsx
  const handleAddToPlanner = async (date: string, mealType: string, recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId);
    if (recipe) {
      const allergens = userProfile.allergies.filter(allergy =>
        recipe.ingredients.some(ing => ing.toLowerCase().includes(allergy.toLowerCase()))
      );
      if (allergens.length > 0) {
        if (!confirm(`Осторожно! Этот рецепт содержит ингредиенты, на которые у вас аллергия: ${allergens.join(', ')}. Все равно добавить?`)) {
          return;
        }
      }
    }
    try {
      await addDoc(collection(db, 'planner'), {
        date,
        mealType,
        type: 'recipe',
        recipeId,
      });
    } catch (error) {
      console.error('Error adding to planner:', error);
    }
  };

  const handleAddProductToPlanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickingMealInfo || !productFormData.name) return;
    try {
      await addDoc(collection(db, 'planner'), {
        date: pickingMealInfo.date,
        mealType: pickingMealInfo.mealType,
        type: 'product',
        productName: productFormData.name,
        amount: productFormData.amount,
        macros: {
          calories: productFormData.calories,
          proteins: productFormData.proteins,
          fats: productFormData.fats,
          carbs: productFormData.carbs,
        },
      });
      setIsAddingProduct(false);
      setProductFormData({ name: '', amount: '', calories: 0, proteins: 0, fats: 0, carbs: 0 });
      alert('Продукт добавлен');
    } catch (error) {
      console.error('Error adding product to planner:', error);
      alert('Ошибка при добавлении продукта');
    }
  };

  const handleRemoveFromPlanner = async (entryId: string) => {
    try {
      await deleteDoc(doc(db, 'planner', entryId));
    } catch (error) {
      console.error('Error removing from planner:', error);
    }
  };
```

- [ ] **Step 3: Add inner helper functions (copy from App.tsx:580-612)**

Continue after the handlers:

```tsx
  const getEntriesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return plannerEntries.filter(e => e.date === dateStr);
  };

  const getRecipeById = (id: string | undefined) => (id ? recipes.find(r => r.id === id) : undefined);

  const getMacrosForDate = (date: Date) => {
    const entries = getEntriesForDate(date);
    return entries.reduce((acc, entry) => {
      if (entry.type === 'recipe' && entry.recipeId) {
        const recipe = getRecipeById(entry.recipeId);
        if (recipe) {
          acc.calories += recipe.macros.calories;
          acc.proteins += recipe.macros.proteins;
          acc.fats += recipe.macros.fats;
          acc.carbs += recipe.macros.carbs;
        }
      } else if (entry.type === 'product' && entry.macros) {
        acc.calories += entry.macros.calories;
        acc.proteins += entry.macros.proteins;
        acc.fats += entry.macros.fats;
        acc.carbs += entry.macros.carbs;
      }
      return acc;
    }, { calories: 0, proteins: 0, fats: 0, carbs: 0 });
  };

  const selectedDateMacros = getMacrosForDate(selectedPlannerDate);
  const isSelectedDateOverLimit =
    selectedDateMacros.calories > userProfile.targetCalories ||
    selectedDateMacros.proteins > userProfile.targetProteins ||
    selectedDateMacros.fats > userProfile.targetFats ||
    selectedDateMacros.carbs > userProfile.targetCarbs;
```

- [ ] **Step 4: Add the four render sub-functions**

Copy `renderDayView`, `renderWeekView`, `renderMonthView`, `renderListView` verbatim from **App.tsx lines 614–1197** with these substitutions:
  - `setSelectedRecipe(recipe)` → `onSelectRecipe(recipe)`  (3 occurrences: lines 719, 911, 1165)

All other references (`mealTypes`, `setActiveAddDropdown`, `activeAddDropdown`, `pickingMealInfo`, `setPickingMealInfo`, `setIsRecipePickerOpen`, `setIsAddingProduct`, `handleRemoveFromPlanner`, `plannerEntries`, `userProfile`, `selectedPlannerDate`, `setSelectedPlannerDate`, `setPlannerViewScale`, `getEntriesForDate`, `getRecipeById`, `isSelectedDateOverLimit`) are already in scope as state/props/closures — no other changes needed.

```tsx
  const renderDayView = () => {
    // Copy verbatim from App.tsx lines 614-857
    // ADAPT: setSelectedRecipe(recipe) → onSelectRecipe(recipe)   [line 719]
  };

  const renderWeekView = () => {
    // Copy verbatim from App.tsx lines 860-1063
    // ADAPT: setSelectedRecipe(recipe) → onSelectRecipe(recipe)   [line 911]
  };

  const renderMonthView = () => {
    // Copy verbatim from App.tsx lines 1066-1127
    // No onSelectRecipe calls here
  };

  const renderListView = () => {
    // Copy verbatim from App.tsx lines 1129-1197
    // ADAPT: setSelectedRecipe(recipe) → onSelectRecipe(recipe)   [line 1165]
  };
```

- [ ] **Step 5: Add the component return() JSX**

Copy the main return body from **App.tsx lines 1199-1385** verbatim (the `renderPlanner()` return). One adaptation: replace `setActiveTab('cart')` with `onNavigateToCart()` at **App.tsx line 1364**.

Then close the component and add the modals:

```tsx
  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24">
      {/* Copy App.tsx lines 1200-1383 verbatim, adapting line 1364: */}
      {/* setActiveTab('cart') → onNavigateToCart() */}

      {/* Product Add Modal — copy from App.tsx lines 2045-2141 verbatim */}
      <AnimatePresence>
        {isAddingProduct && (
          // ... exact copy from App.tsx 2046-2141
        )}
      </AnimatePresence>

      {/* Recipe Picker Modal — copy from App.tsx lines 2191-2245 verbatim */}
      <AnimatePresence>
        {isRecipePickerOpen && (
          // ... exact copy from App.tsx 2192-2245
          // Inside: onClick={() => handleAddToPlanner(...)} — stays the same
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 6: Run TypeScript check on the new file**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors. Fix any that appear before continuing.

---

## Task 3: Update App.tsx

**Files:**
- Modify: `src/App.tsx`

Apply all changes in this order to avoid intermediate broken states.

- [ ] **Step 1: Add `PlannerView` import and remove unused type imports**

At the top of App.tsx, after the existing feature imports, add:
```tsx
import { PlannerView } from '@/features/planner/PlannerView';
```

In the type import block (App.tsx lines 78-90), remove `PlannerViewScale`, `PlannerViewMode`, `Subfolder`, `Resource` (none remain in use after extraction). Keep `CartItem`, `Tab`, `Recipe`, `UserProfile`, `Program`, `PlannerEntry`.

- [ ] **Step 2: Remove unused lucide-react icon imports**

From the lucide-react import block (App.tsx lines 7-45), remove: `ChevronLeft`, `Trash2`, `List`, `ChefHat`, `ShoppingCart`.

Keep: `BookOpen` (header line 1957), `Calendar` (renderTracker line 1574), `AlertCircle` (renderTracker lines 1487+), `ChevronRight` (renderTracker line 1628), `Plus` (AI suggestion modal + Recipe Selection Bar + Program Selection Modal).

- [ ] **Step 3: Remove all unused date-fns imports**

From the date-fns import (lines 54-67), remove: `addDays`, `startOfWeek`, `endOfWeek`, `eachDayOfInterval`, `isSameDay`, `startOfMonth`, `endOfMonth`, `subDays`, `addMonths`, `subMonths`, `isToday`, `parseISO`.

Keep only: `format` (used by renderTracker line 1391).

Remove the entire `import { ru } from 'date-fns/locale';` line.

- [ ] **Step 4: Remove `plannerEntries` state + its `onSnapshot` useEffect**

Remove line 184:
```tsx
const [plannerEntries, setPlannerEntries] = useState<PlannerEntry[]>([]);
```

Remove lines 469-479:
```tsx
useEffect(() => {
  const q = query(collection(db, "planner"));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const entries: PlannerEntry[] = [];
    querySnapshot.forEach((doc) => {
      entries.push({ id: doc.id, ...doc.data() } as PlannerEntry);
    });
    setPlannerEntries(entries);
  });
  return () => unsubscribe();
}, []);
```

- [ ] **Step 5: Add `plannerEntries` to `useData()` destructuring**

Find line 338:
```tsx
const { programs } = useData();
```
Replace with:
```tsx
const { programs, plannerEntries } = useData();
```

This ensures `renderTracker` (which uses `plannerEntries` at lines 1392-1393) still works.

- [ ] **Step 6: Remove 8 planner-internal state declarations**

Remove these declarations (they are now internal to PlannerView):

Line 186: `const [plannerViewScale, setPlannerViewScale] = useState<PlannerViewScale>('week');`
Line 187: `const [plannerViewMode, setPlannerViewMode] = useState<PlannerViewMode>('calendar');`
Line 188: `const [selectedPlannerDate, setSelectedPlannerDate] = useState(new Date());`
Line 189: `const [isRecipePickerOpen, setIsRecipePickerOpen] = useState(false);`
Line 190: `const [isMainRecipesOpen, setIsMainRecipesOpen] = useState(true);` ← dead code, just delete
Line 191: `const [pickingMealInfo, setPickingMealInfo] = useState<{date: string, mealType: string} | null>(null);`
Line 333: `const [activeAddDropdown, setActiveAddDropdown] = useState<string | null>(null);`
Line 334: `const [isAddingProduct, setIsAddingProduct] = useState(false);`
Lines 385-392: `const [productFormData, setProductFormData] = useState({...});`

- [ ] **Step 7: Remove the 3 planner handler functions**

Remove `handleAddProductToPlanner` (App.tsx lines 519-544).
Remove `handleAddToPlanner` (App.tsx lines 547-569).
Remove `handleRemoveFromPlanner` (App.tsx lines 571-577).

- [ ] **Step 8: Remove the `renderPlanner()` function**

Remove lines 579-1386 (the entire `const renderPlanner = () => { ... };` block including trailing blank lines).

- [ ] **Step 9: Replace `renderPlanner()` call in `renderContent()`**

Find (App.tsx ~line 1780 after removals):
```tsx
case 'planner':
  return renderPlanner();
```

Replace with:
```tsx
case 'planner':
  return (
    <PlannerView
      recipes={recipes}
      userProfile={userProfile}
      activeNutritionPlan={activeNutritionPlan}
      checkedEntries={checkedEntries}
      onCheckedEntriesChange={setCheckedEntries}
      onSelectRecipe={setSelectedRecipe}
      onNavigateToCart={() => setActiveTab('cart')}
      mealTypes={mealTypes}
      onMealTypesChange={setMealTypes}
    />
  );
```

- [ ] **Step 10: Remove Product Add Modal from App.tsx return JSX**

Remove the `{/* Product Add Modal (Planner) */}` block (App.tsx lines 2044-2142). It is now rendered inside PlannerView.

- [ ] **Step 11: Remove Recipe Picker Modal from App.tsx return JSX**

Remove the `{/* Recipe Picker Modal */}` block (App.tsx lines 2190-2246). It is now rendered inside PlannerView.

- [ ] **Step 12: Run TypeScript check**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager
npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors. Fix any that appear before continuing.

---

## Task 4: Verify

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager
npx vitest run
```

Expected: All existing 97 tests pass + 1 new PlannerView smoke test = **98 tests, 0 failures**.

- [ ] **Step 2: Verify App.tsx line count**

```bash
wc -l /Users/evidenee/Flowgence/Rezept_Manager/src/App.tsx
```

Expected: ~1500 lines (was 2482, target ~−40%).

- [ ] **Step 3: Verify no Firestore imports leak into planner feature path**

```bash
grep -r "firebase/firestore" /Users/evidenee/Flowgence/Rezept_Manager/src/features/planner/
```

Expected: Only `PlannerView.tsx` (direct Firestore writes are intentional at this phase — repository migration deferred to Phase 3).

- [ ] **Step 4: Commit**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager
git add src/features/planner/PlannerView.tsx \
        src/features/planner/__tests__/PlannerView.test.tsx \
        src/App.tsx
git commit -m "feat(planner): extract PlannerView from App.tsx into src/features/planner/"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `PlannerView.tsx` created in `src/features/planner/`
- [x] `plannerEntries` read from `useData()` — duplicate `onSnapshot` removed from App.tsx
- [x] 8 state variables moved: `plannerViewScale`, `plannerViewMode`, `selectedPlannerDate`, `isRecipePickerOpen`, `pickingMealInfo`, `isAddingProduct`, `activeAddDropdown`, `productFormData`
- [x] 3 handlers moved: `handleAddToPlanner`, `handleAddProductToPlanner`, `handleRemoveFromPlanner`
- [x] All 4 view functions: `renderDayView`, `renderWeekView`, `renderMonthView`, `renderListView`
- [x] Product Add Modal moved to PlannerView
- [x] Recipe Picker Modal moved to PlannerView
- [x] Safety-critical: `handleAddToPlanner` retains allergy check before `addDoc`
- [x] `checkedEntries` stays in App.tsx (Tracker reads it for `handleSuggest`)
- [x] `mealTypes` stays in App.tsx (Tracker uses it at line 1586)
- [x] `customPlanForm` stays in App.tsx (Tracker's Program Selection Modal)
- [x] `onSelectRecipe` prop replaces all `setSelectedRecipe(recipe)` calls (3 places)
- [x] `onNavigateToCart` prop replaces `setActiveTab('cart')` (1 place in shopping list button)

**Placeholder scan:** No TBD/TODO/placeholder text — Step 4 uses "Copy verbatim from App.tsx lines X-Y" which is explicit and actionable.

**Type consistency:** `ActiveNutritionPlan` (not `NutritionPlan`) used throughout — matches `@/shared/domain/types`.
