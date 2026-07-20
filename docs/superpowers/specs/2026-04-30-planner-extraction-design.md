# Planner Tab Extraction — Design Spec

**Date:** 2026-04-30
**Status:** Approved
**Goal:** Extract the Planner tab from `App.tsx` (~1047 lines) into `src/features/planner/PlannerView.tsx`, eliminating the duplicate Firestore `planner` subscription and reducing App.tsx by ~40%.

---

## Architecture

### Single new file

```
src/features/planner/PlannerView.tsx   (~900 lines)
```

All four view functions (`renderDayView`, `renderWeekView`, `renderMonthView`, `renderListView`) remain as internal helper functions inside `PlannerView` — no further splitting. This mirrors the existing structure in App.tsx and is consistent with how `RecipesView.tsx` was handled.

---

## Data Access

`PlannerView` reads `plannerEntries` from `DataContext` (already subscribed):

```tsx
const { planner: plannerEntries } = useData();
```

This removes the `plannerEntries` useState + `onSnapshot` useEffect from App.tsx.

---

## Props Interface

```tsx
export type PlannerViewProps = {
  recipes: Recipe[];
  userProfile: UserProfile;
  activeNutritionPlan: NutritionPlan | null;
  checkedEntries: string[];
  onCheckedEntriesChange: (entries: string[]) => void;
  onAddProductsToCart: (products: string[]) => void;
  onSelectRecipe: (recipe: Recipe) => void;
};
```

| Prop                                        | Why in App.tsx, not internal                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `recipes`                                   | Needed for recipe picker and per-entry macro calculation                                                        |
| `userProfile`                               | Allergy check in `handleAddToPlanner`; target KBZHU limits                                                      |
| `activeNutritionPlan`                       | Active plan overrides profile KBZHU goals (safety-critical constraint)                                          |
| `checkedEntries` / `onCheckedEntriesChange` | Shared with Tracker — `handleSuggest` (Tracker-feature) reads it; Planner day view toggles it                   |
| `onAddProductsToCart`                       | Day view has "add to cart" buttons                                                                              |
| `onSelectRecipe`                            | Recipe cards in day/week/list views open the recipe detail (all three view modes, App.tsx lines 719, 911, 1165) |

---

## What Moves Into PlannerView

### State (8 useState)

| Variable              | Type                                         | Owner    |
| --------------------- | -------------------------------------------- | -------- |
| `plannerViewScale`    | `PlannerViewScale`                           | internal |
| `plannerViewMode`     | `PlannerViewMode`                            | internal |
| `selectedPlannerDate` | `Date`                                       | internal |
| `isRecipePickerOpen`  | `boolean`                                    | internal |
| `pickingMealInfo`     | `{ date: string; mealType: string } \| null` | internal |
| `isAddingProduct`     | `boolean`                                    | internal |
| `customPlanForm`      | form data object                             | internal |
| `productFormData`     | form data object                             | internal |

### Handlers (3 functions)

| Function                    | What it does                                                 |
| --------------------------- | ------------------------------------------------------------ |
| `handleAddToPlanner`        | Allergy-checks recipe, then `addDoc` to `planner` collection |
| `handleAddProductToPlanner` | `addDoc` manual product to `planner` collection              |
| `handleRemoveFromPlanner`   | `deleteDoc` by entry ID from `planner` collection            |

### JSX (from App.tsx)

- `renderPlanner()` body — all four view helpers and conditional render (~811 lines, App.tsx 579–1389)
- Product Add Modal (App.tsx ~2044–2090)
- Recipe Picker Modal (App.tsx ~2190–2240)

---

## What Stays in App.tsx

| Item                      | Reason                                               |
| ------------------------- | ---------------------------------------------------- |
| `checkedEntries` useState | Tracker reads it for `handleSuggest`                 |
| `handleSuggest`           | Tracker-feature; moves to Tracker tab when extracted |

---

## App.tsx Changes

### Remove

- `plannerEntries` useState + its `onSnapshot` useEffect
- 8 useState declarations listed above
- 3 handler functions
- `renderPlanner()` function (~811 lines)
- Product Add Modal and Recipe Picker Modal from `return()`

### Add

```tsx
import { PlannerView } from '@/features/planner/PlannerView';
```

### Replace in renderContent()

```tsx
case 'planner':
  return (
    <PlannerView
      recipes={recipes}
      userProfile={userProfile}
      activeNutritionPlan={activeNutritionPlan}
      checkedEntries={checkedEntries}
      onCheckedEntriesChange={setCheckedEntries}
      onAddProductsToCart={addProductsToCart}
      onSelectRecipe={setSelectedRecipe}
    />
  );
```

---

## Expected Outcome

| Metric          | Before  | After        |
| --------------- | ------- | ------------ |
| App.tsx lines   | 2482    | ~1500 (−40%) |
| PlannerView.tsx | —       | ~900 lines   |
| TS errors       | 0       | 0            |
| Tests           | 97 pass | 97 pass      |

---

## Safety-Critical Constraint

`handleAddToPlanner` **must** run the allergy check before `addDoc`. This is a safety-critical rule (CLAUDE.md). The check uses `userProfile.allergies` and `recipeAllergens()` from `@/shared/domain/allergies`. Do not remove or bypass it during extraction.

---

## Out of Scope

- No new functionality
- No UI changes
- `handleSuggest` extraction (deferred to Tracker step)
- Splitting into sub-components (deliberately chosen against)
