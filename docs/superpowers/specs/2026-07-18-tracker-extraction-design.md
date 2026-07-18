# Tracker Extraction Design

**Date:** 2026-07-18  
**Phase:** Phase 1, Step 4  
**Status:** Approved

---

## Context

`App.tsx` is being decomposed from a ~1400-line monolith into feature modules. Recipes, Cart, Planner, Programs are already extracted. Tracker is the last remaining tab. After extraction, App.tsx should reach < 200 lines and proceed to Step 5 (final cleanup).

Tracker currently consists of three pieces inside App.tsx:
- `renderTracker()` — main view (lines 450–807, ~357 lines)
- AI Suggest Modal — in JSX return (lines 892–1021, ~130 lines)
- ProgramSelection Modal — in JSX return (lines 1162–1395, ~230 lines)

---

## File Structure

```
src/features/tracker/
  TrackerView.tsx            ← main view + state orchestration
  AISuggestModal.tsx         ← AI suggestion modal (standalone component)
  ProgramSelectionModal.tsx  ← program selection modal (standalone component)
  __tests__/
    TrackerView.test.tsx
```

---

## Architecture

### TrackerView

**Props (shared state only):**

```ts
type TrackerViewProps = {
  checkedEntries: string[];
  onCheckedEntriesChange: (entries: string[]) => void;
  mealTypes: string[];
  onSelectRecipe: (recipe: Recipe) => void;
  onNavigateToPlanner: () => void;
};
```

**Context hooks called directly inside TrackerView:**
- `useData()` → `plannerEntries`, `recipes`, `programs`
- `useNutritionPlan()` → `activeNutritionPlan`, `setActivePlan`
- `useUserProfile()` → `userProfile`

**Internal state (moves from App.tsx):**

```ts
const [isSuggesting, setIsSuggesting] = useState(false);
const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
const [isProgramSelectionOpen, setIsProgramSelectionOpen] = useState(false);
```

**Functions (move from App.tsx):**
- `handleSuggest(isAlternative: boolean)` — calls `aiClient.fillRemaining()`, updates `suggestion`
- `handleAddSelectedSuggestions()` — writes selected options to Firestore (`collection(db, "planner")`)

**Deduplication:** App.tsx currently has two copies of the "add suggestions" logic — one in `renderTracker` (lines 783–800) and one in the modal (lines 980–1006). The extracted version uses a single `handleAddSelectedSuggestions` function called from `AISuggestModal` only. The inline copy in renderTracker is removed.

---

### AISuggestModal

Self-contained modal component. Receives all display data and callbacks as props — no context calls inside.

```ts
type AISuggestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  suggestion: SuggestionResult | null;
  isSuggesting: boolean;
  selectedIds: string[];
  onToggleId: (id: string) => void;
  onAddSelected: () => Promise<void>;
  onRequestAlternative: () => void;
};
```

**`SuggestionResult` type** (extracted to `TrackerView.tsx` or `shared/domain/types.ts` if reused):
```ts
type SuggestionResult = {
  options: {
    id: string;
    type: 'recipe' | 'product';
    recipeId?: string;
    description: string;
    macros: { calories: number; proteins: number; fats: number; carbs: number };
  }[];
  reason: string;
};
```

---

### ProgramSelectionModal

Calls context hooks directly (avoids threading ~10 props through TrackerView):
- `useData()` → `programs`
- `useNutritionPlan()` → `activeNutritionPlan`, `setActivePlan`
- `useUserProfile()` → `userProfile.name`

```ts
type ProgramSelectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
};
```

Internal state:
```ts
const [customPlanForm, setCustomPlanForm] = useState({ name: '', calories: 0, proteins: 0, fats: 0, carbs: 0 });
```

`customPlanForm` and its state move from App.tsx into this component since they are exclusively used here.

---

## What Changes in App.tsx

**Removed:**
- `useState` for `suggestion`, `selectedSuggestionIds`, `isSuggesting`, `isProgramSelectionOpen`, `customPlanForm`
- Functions `handleSuggest`, `handleAddSelectedSuggestions`
- `renderTracker()` function body
- AI Suggest Modal JSX (lines 892–1021)
- ProgramSelection Modal JSX (lines 1162–1395)

**Replaced:**
```tsx
case 'tracker':
  return renderTracker();
```
→
```tsx
case 'tracker':
  return (
    <TrackerView
      checkedEntries={checkedEntries}
      onCheckedEntriesChange={setCheckedEntries}
      mealTypes={mealTypes}
      onSelectRecipe={setSelectedRecipe}
      onNavigateToPlanner={() => setActiveTab('planner')}
    />
  );
```

---

## Data Flow

```
App.tsx
  └── TrackerView (checkedEntries, mealTypes, onSelectRecipe, onNavigateToPlanner)
        ├── useData()            → plannerEntries, recipes, programs
        ├── useNutritionPlan()  → activeNutritionPlan, setActivePlan
        ├── useUserProfile()    → userProfile
        ├── AISuggestModal (suggestion, isSuggesting, selectedIds, callbacks)
        └── ProgramSelectionModal (isOpen, onClose)
              ├── useData()            → programs
              ├── useNutritionPlan()  → activeNutritionPlan, setActivePlan
              └── useUserProfile()    → userProfile.name
```

---

## Testing

**`TrackerView.test.tsx`** (smoke + critical behaviour):
- Renders without crash with mocked `useData`, `useNutritionPlan`, `useUserProfile`
- Displays macros computed from `checkedEntries` (KBZHU sync invariant)
- "Заполнить остаток кбжу" button triggers `aiClient.fillRemaining`
- "Перейти в планер" calls `onNavigateToPlanner`

Modals are covered integration-style through TrackerView tests; no separate modal unit tests at this stage.

---

## Success Criteria

- `npm run build` — green
- `npm run lint` (tsc --noEmit) — 0 errors
- App.tsx drops to < 300 lines after extraction (< 200 after Step 5 cleanup)
- No behaviour regression in Tracker tab (checkedEntries sync with Planner preserved)
- Allergy check invariant intact (TrackerView only reads from `activeNutritionPlan` and `userProfile.allergies`, does not bypass them)
