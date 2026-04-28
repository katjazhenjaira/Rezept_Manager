# Programs Tab Extraction — Design Spec

**Date:** 2026-04-28  
**Phase:** 1, Step 4 (Programs)  
**Status:** Approved

---

## Goal

Extract the Programs tab from `App.tsx` (currently ~2700 lines of Programs-specific code) into `src/features/programs/`, following the same pattern as CartView and RecipesView. Simultaneously eliminate the duplicate `onSnapshot` subscription for programs by switching to `DataContext`.

---

## Approach

- **Data reading:** `useDataContext()` inside ProgramsView (Approach B) — eliminates duplicate Firestore subscription from App.tsx
- **Writes:** direct `addDoc / updateDoc / deleteDoc` via firebase/firestore (same as RecipesView, CartView)
- **Detail modal placement:** `openProgramId` as a controlled prop lifted to App.tsx (Variant Y) — same pattern as `selectedRecipe` in RecipesView

---

## New Files

```
src/features/programs/
  ProgramsView.tsx          ~800 lines
  ProgramDetailModal.tsx    ~1400 lines
```

---

## Architecture

### ProgramsView.tsx

Orchestrates the Programs tab. Reads `programs` from `useDataContext()`. Renders the program card grid, the create/edit modal, and the delete confirmation modal. Mounts `ProgramDetailModal` when `openProgramId !== null`.

**Internal state:**
- `programFormData`, `editingProgramId`, `isCreatingProgram`, `isCreateProgramDropdownOpen`
- `programToDelete`
- `programRecipeFilter` (used in both card grid and detail modal)
- `subfolderRecipeFilters` (used in create/edit form)
- `editingSubfolderId` (subfolder photo in form)
- Refs: `programPhotoInputRef`, `programPdfInputRef`, `subfolderPhotoInputRef`

**Handlers owned:**
- `handleCreateProgram`, `handleShareProgram`
- `handleProgramPhotoUpload`, `handleProgramPdfUpload`, `handleSubfolderPhotoUpload`

**Props:**
```typescript
type ProgramsViewProps = {
  recipes: Recipe[];
  availableCategories: string[];
  userProfile: UserProfile;
  // Controlled: which program's detail is open
  openProgramId: string | null;
  onOpenProgramIdChange: (id: string | null) => void;
  // Cross-tab: recipe selection flow
  isRecipeSelectionMode: boolean;
  selectionTarget: { programId: string; subfolderId: string | 'main' } | null;
  selectedRecipeIds: string[];
  onSelectedRecipeIdsChange: (ids: string[]) => void;
  onStartRecipeSelection: (programId: string, subfolderId: string | 'main') => void;
  onAddSelectedRecipes: () => Promise<void>;
  // Cross-tab: import recipe directly into a program slot
  recipeTarget: { programId: string; subfolderId: string | 'main' } | null;
  onRecipeTargetCleared: () => void;
  photoInputRef: React.RefObject<HTMLInputElement>;
  isAddingManual: boolean; onIsAddingManualChange: (v: boolean) => void;
  isAddingLink: boolean;   onIsAddingLinkChange: (v: boolean) => void;
  isAddingPDF: boolean;    onIsAddingPDFChange: (v: boolean) => void;
  isScanning: boolean;     onIsScanningChange: (v: boolean) => void;
  // Cross-domain
  onAddProductsToCart: (products: string[]) => void;
};
```

---

### ProgramDetailModal.tsx

Renders the full-screen overlay for a single open program. Manages all detail-level UI state independently.

**Internal state:**
- `openSubfolderId`, `editingSubfolderId`
- `editingEntity`, `editFormData`
- `programAddRecipeDropdown`
- `subfolderToDelete`
- `showProducts`
- `activeResourceForm`, `resourceFormData`
- Ref: `subfolderPdfInputRef`

**Handlers owned:**
- `handleDropRecipe` (DnD between subfolders)
- `handleSubfolderPdfUpload`
- Inline subfolder CRUD (create, rename, delete)
- Edit entity (program/subfolder inline edit)

**Props:**
```typescript
type ProgramDetailModalProps = {
  program: Program;
  recipes: Recipe[];
  availableCategories: string[];
  programRecipeFilter: string;
  onProgramRecipeFilterChange: (f: string) => void;
  onClose: () => void;
  onDeleteProgram: (program: Program) => void;
  // Cross-tab (proxied from ProgramsView)
  onStartRecipeSelection: (programId: string, subfolderId: string | 'main') => void;
  recipeTarget: { programId: string; subfolderId: string | 'main' } | null;
  onRecipeTargetCleared: () => void;
  photoInputRef: React.RefObject<HTMLInputElement>;
  isAddingManual: boolean; onIsAddingManualChange: (v: boolean) => void;
  isAddingLink: boolean;   onIsAddingLinkChange: (v: boolean) => void;
  isAddingPDF: boolean;    onIsAddingPDFChange: (v: boolean) => void;
  isScanning: boolean;     onIsScanningChange: (v: boolean) => void;
  onAddProductsToCart: (products: string[]) => void;
};
```

`onDeleteProgram` — ProgramDetailModal signals "user wants to delete", ProgramsView shows the confirm dialog and executes `deleteDoc` + `onOpenProgramIdChange(null)`.

---

## App.tsx Changes

| What | Action |
|---|---|
| `programs` onSnapshot (line ~526) | Remove; replace with `const { programs } = useDataContext()` |
| `activeCollectionId` | Rename to `openProgramId`, keep as lifted state |
| `renderPrograms()` (lines 1656–2319) | Remove |
| Detail modal JSX (lines 2728–4191) | Remove (moves to ProgramDetailModal) |
| Program/subfolder delete modals (lines 4201–4301) | Remove (moves to ProgramsView / ProgramDetailModal) |
| All Programs-specific state | Remove from App.tsx |
| `renderContent()` case 'programs' | Replace `renderPrograms()` with `<ProgramsView ... />` |
| `handleStartRecipeSelection` | Keep in App.tsx — uses `programs` from `useDataContext()` |
| `handleAddSelectedRecipes` | Keep in App.tsx — uses `programs` from `useDataContext()` |

**State that stays in App.tsx (cross-tab):**
`openProgramId`, `selectionTarget`, `recipeTarget`, `isRecipeSelectionMode`, `selectedRecipeIds`, `isAddingManual`, `isAddingLink`, `isAddingPDF`, `isScanning`

**State NOT in scope (stays in App.tsx for Tracker extraction):**
`isProgramSelectionOpen` and its modal — triggered from Tracker tab, moves when Tracker is extracted.

---

## Data Flow

```
DataContext
  └─ programs ──────────────────► ProgramsView (useDataContext)
                                        └─► ProgramDetailModal (prop)

App.tsx
  ├─ programs (useDataContext) ──► handleAddSelectedRecipes
  ├─ openProgramId ─────────────► ProgramsView ──► ProgramDetailModal
  ├─ recipes ───────────────────► ProgramsView ──► ProgramDetailModal
  ├─ selectionTarget ───────────► ProgramsView
  ├─ recipeTarget ──────────────► ProgramsView ──► ProgramDetailModal
  └─ isAdding* / isScanning ────► ProgramsView ──► ProgramDetailModal
```

---

## Error Handling

No changes — all firebase calls remain wrapped in `try/catch` with `alert`. Proper error handling deferred to Phase 2.

---

## Verification Checklist

- `npm run build` — green, 0 TS errors
- `npm run test` — all existing tests pass
- `wc -l src/App.tsx` — expected ~2000 lines (down from 4538)
- Manual flows:
  - Open a program card → detail modal appears
  - Create subfolder → appears in detail
  - Add recipe from library → switches to Recipes tab in selection mode → confirm → returns to Programs detail
  - Drag recipe between subfolders
  - Share program → URL copied to clipboard
  - Delete program → confirm dialog → program removed, modal closes
  - Delete subfolder → confirm dialog → subfolder removed
  - URL param `?programId=X` → program detail opens on load
