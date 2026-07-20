# Phase 1 Step 5 — App.tsx Final Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `App.tsx` from 540 lines to ~300 by eliminating triplicated PDF utility functions, removing three duplicate `onSnapshot` subscriptions (replaced by existing Context), and extracting large inline JSX blocks into layout components.

**Architecture:** `src/shared/utils/pdfUtils.ts` becomes the single source for PDF utilities (was 3 copies). `AppHeader` and `RecipeSelectionBar` each isolate their own JSX and state. `SettingsModal` calls `useUserProfile()` directly (removes prop drilling). App.tsx replaces local `recipes`/`cart`/`userProfile` state+subscriptions with `useData()` / `useUserProfile()` reads. No feature behaviour changes.

**Tech Stack:** React 19, TypeScript strict, Firebase Firestore, `pdfjs-dist`, `motion/react`, `lucide-react`, `clsx`+`tailwind-merge`, Vitest.

**Expected result:** App.tsx ~300 lines (from 540). Reducing further to < 200 requires a future `RecipeSelectionContext` step to extract cross-tab import-modal state.

---

## File Map

| Action | File                                           | What changes                                                                        |
| ------ | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| Create | `src/shared/utils/pdfUtils.ts`                 | Single source for `extractImageFromPDF` + `extractTextFromPDF` + pdfjs worker setup |
| Modify | `src/features/recipes/RecipesView.tsx`         | Remove 3 duplicate pdfjs lines + 2 function bodies; import from pdfUtils            |
| Modify | `src/features/programs/ProgramsView.tsx`       | Same removals as RecipesView                                                        |
| Modify | `src/features/programs/ProgramDetailModal.tsx` | Absorb `addProductsToCart`; remove `onAddProductsToCart` prop                       |
| Modify | `src/features/programs/ProgramsView.tsx`       | Remove `onAddProductsToCart` from props                                             |
| Modify | `src/features/settings/SettingsModal.tsx`      | Use `useUserProfile()` context; remove `userProfile`/`setUserProfile` props         |
| Create | `src/app/layout/AppHeader.tsx`                 | Header JSX + language switcher (internal state)                                     |
| Create | `src/app/layout/RecipeSelectionBar.tsx`        | Floating recipe selection bar                                                       |
| Modify | `src/App.tsx`                                  | Remove all of the above; switch to context reads; use new layout components         |

---

## Task 1: Create shared PDF utility module

**Files:**

- Create: `src/shared/utils/pdfUtils.ts`

The functions `extractImageFromPDF` and `extractTextFromPDF` currently exist identically in three files: `App.tsx`, `RecipesView.tsx`, and `ProgramsView.tsx`. This task creates the canonical copy.

- [ ] **Step 1.1: Create the file**

```ts
// src/shared/utils/pdfUtils.ts
import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Worker setup runs once on first import — satisfies all three former call sites.
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractImageFromPDF(
  pdfData: string,
  pageNumber: number,
  box: { ymin: number; xmin: number; ymax: number; xmax: number },
): Promise<string> {
  try {
    const binaryString = atob(pdfData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const loadingTask = pdfjs.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return '';
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (page as any).render({ canvasContext: context, viewport }).promise;
    const x = (box.xmin / 1000) * canvas.width;
    const y = (box.ymin / 1000) * canvas.height;
    const width = ((box.xmax - box.xmin) / 1000) * canvas.width;
    const height = ((box.ymax - box.ymin) / 1000) * canvas.height;
    if (width <= 0 || height <= 0) return canvas.toDataURL('image/jpeg');
    const cropCanvas = document.createElement('canvas');
    const cropContext = cropCanvas.getContext('2d');
    if (!cropContext) return canvas.toDataURL('image/jpeg');
    cropCanvas.width = width;
    cropCanvas.height = height;
    cropContext.drawImage(canvas, x, y, width, height, 0, 0, width, height);
    return cropCanvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return '';
  }
}

export async function extractTextFromPDF(pdfData: string): Promise<string> {
  const binaryString = atob(pdfData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    parts.push(`--- Page ${i} ---`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parts.push(content.items.map((item: any) => item.str).join(' '));
  }
  return parts.join('\n');
}
```

- [ ] **Step 1.2: Verify TypeScript**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 1.3: Commit**

```bash
git add src/shared/utils/pdfUtils.ts
git commit -m "feat(shared): extract pdfUtils — single source for extractImageFromPDF and extractTextFromPDF"
```

---

## Task 2: Remove PDF duplication from RecipesView

**Files:**

- Modify: `src/features/recipes/RecipesView.tsx`

RecipesView.tsx has `import * as pdfjs from 'pdfjs-dist'` (line ~36) and defines both functions locally (~lines 80–136). These are replaced by a single import from pdfUtils.

- [ ] **Step 2.1: Replace pdfjs import with pdfUtils import**

Find in RecipesView.tsx:

```tsx
import * as pdfjs from 'pdfjs-dist';
```

Replace with:

```tsx
import { extractImageFromPDF, extractTextFromPDF } from '@/shared/utils/pdfUtils';
```

- [ ] **Step 2.2: Delete local `extractImageFromPDF` function**

The function body begins with:

```tsx
const extractImageFromPDF = async (
  pdfData: string,
  pageNumber: number,
  box: { ymin: number; xmin: number; ymax: number; xmax: number },
): Promise<string> => {
```

Delete the entire function (from `const extractImageFromPDF` to its closing `};`). It is approximately 35 lines.

- [ ] **Step 2.3: Delete local `extractTextFromPDF` function**

The function body begins with:

```tsx
const extractTextFromPDF = async (pdfData: string): Promise<string> => {
```

Delete the entire function (~11 lines).

- [ ] **Step 2.4: Verify TypeScript and tests**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npx tsc --noEmit 2>&1 | head -20 && npx vitest run 2>&1 | tail -10
```

Expected: 0 TS errors, all tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add src/features/recipes/RecipesView.tsx
git commit -m "refactor(recipes): import pdfUtils from shared utility, remove local duplicate"
```

---

## Task 3: Remove PDF duplication from ProgramsView

**Files:**

- Modify: `src/features/programs/ProgramsView.tsx`

ProgramsView.tsx has the same three items to remove as Task 2.

- [ ] **Step 3.1: Replace pdfjs import**

Find in ProgramsView.tsx (line ~12):

```tsx
import * as pdfjs from 'pdfjs-dist';
```

Replace with:

```tsx
import { extractImageFromPDF, extractTextFromPDF } from '@/shared/utils/pdfUtils';
```

- [ ] **Step 3.2: Delete local `extractImageFromPDF` function**

Beginning around line 41:

```tsx
const extractImageFromPDF = async (
  pdfData: string,
  pageNumber: number,
  box: { ymin: number; xmin: number; ymax: number; xmax: number },
): Promise<string> => {
```

Delete the entire function (~35 lines, to closing `};`).

- [ ] **Step 3.3: Delete local `extractTextFromPDF` function**

Beginning immediately after:

```tsx
const extractTextFromPDF = async (pdfData: string): Promise<string> => {
```

Delete the entire function (~11 lines).

- [ ] **Step 3.4: Verify TypeScript and tests**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npx tsc --noEmit 2>&1 | head -20 && npx vitest run 2>&1 | tail -10
```

Expected: 0 errors, all tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add src/features/programs/ProgramsView.tsx
git commit -m "refactor(programs): import pdfUtils from shared utility, remove local duplicate"
```

---

## Task 4: Move `addProductsToCart` into ProgramDetailModal

**Files:**

- Modify: `src/features/programs/ProgramDetailModal.tsx`
- Modify: `src/features/programs/ProgramsView.tsx`

`addProductsToCart` in `App.tsx` (25 lines) is only ever called from `ProgramDetailModal` via the prop chain `App.tsx → ProgramsView → ProgramDetailModal`. Since ProgramDetailModal already imports `updateDoc`/`doc` from Firebase and `db`, it can own this function directly.

**Context:** `addProductsToCart` in App.tsx looks like:

```ts
const addProductsToCart = async (products: string[]) => {
  try {
    for (const product of products) {
      if (!product.trim()) continue;
      const parts = product.trim().split(' ');
      let name = product;
      let amount = '';
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        if (lastPart && /\d/.test(lastPart)) {
          amount = lastPart;
          name = parts.slice(0, -1).join(' ');
        }
      }
      const isBasic = isStaple(name);
      await addDoc(collection(db, 'cart'), {
        name,
        amount,
        sourceDishes: ['Из программы'],
        checked: false,
        isBasic,
        createdAt: new Date().toISOString(),
      });
    }
    alert('Продукты добавлены в корзину!');
  } catch (error) {
    console.error('Error adding to cart:', error);
    alert('Ошибка при добавлении в корзину');
  }
};
```

- [ ] **Step 4.1: Add missing imports to ProgramDetailModal.tsx**

ProgramDetailModal currently has `import { updateDoc, doc } from 'firebase/firestore'`. Extend it:

```tsx
import { updateDoc, doc, addDoc, collection } from 'firebase/firestore';
```

Also add `isStaple` import after the existing firebase imports:

```tsx
import { isStaple } from '@/features/cart/services/staples';
```

- [ ] **Step 4.2: Add `addProductsToCart` function inside ProgramDetailModal**

Inside `ProgramDetailModal` function body, right after the props destructuring block (before any JSX), add:

```tsx
const addProductsToCart = async (products: string[]) => {
  try {
    for (const product of products) {
      if (!product.trim()) continue;
      const parts = product.trim().split(' ');
      let name = product;
      let amount = '';
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        if (lastPart && /\d/.test(lastPart)) {
          amount = lastPart;
          name = parts.slice(0, -1).join(' ');
        }
      }
      const isBasic = isStaple(name);
      await addDoc(collection(db, 'cart'), {
        name,
        amount,
        sourceDishes: ['Из программы'],
        checked: false,
        isBasic,
        createdAt: new Date().toISOString(),
      });
    }
    alert('Продукты добавлены в корзину!');
  } catch (error) {
    console.error('Error adding to cart:', error);
    alert('Ошибка при добавлении в корзину');
  }
};
```

- [ ] **Step 4.3: Remove `onAddProductsToCart` from ProgramDetailModalProps**

In `ProgramDetailModalProps` type, remove:

```tsx
  onAddProductsToCart: (products: string[]) => void;
```

And in the destructuring at the top of `ProgramDetailModal`, remove `onAddProductsToCart`.

The two call sites in ProgramDetailModal (`onAddProductsToCart([...])`) now call the local function directly. Replace both:

```tsx
// Line ~365 — before:
onClick={() => onAddProductsToCart([...(program.allowedProducts || []), ...(program.forbiddenProducts || [])])}
// After:
onClick={() => void addProductsToCart([...(program.allowedProducts || []), ...(program.forbiddenProducts || [])])}
```

```tsx
// Line ~621 — before:
onClick={(e) => { e.stopPropagation(); onAddProductsToCart([...(subfolder.allowedProducts || []), ...(subfolder.forbiddenProducts || [])]); }}
// After:
onClick={(e) => { e.stopPropagation(); void addProductsToCart([...(subfolder.allowedProducts || []), ...(subfolder.forbiddenProducts || [])]); }}
```

- [ ] **Step 4.4: Remove `onAddProductsToCart` from ProgramsView**

In `ProgramsView.tsx`:

1. Remove `onAddProductsToCart: (products: string[]) => void;` from `ProgramsViewProps`
2. Remove `onAddProductsToCart` from the props destructuring
3. Remove `onAddProductsToCart={onAddProductsToCart}` from the `<ProgramDetailModal>` call

- [ ] **Step 4.5: Verify TypeScript and tests**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npx tsc --noEmit 2>&1 | head -20 && npx vitest run 2>&1 | tail -10
```

Expected: 0 errors, all tests pass.

- [ ] **Step 4.6: Commit**

```bash
git add src/features/programs/ProgramDetailModal.tsx src/features/programs/ProgramsView.tsx
git commit -m "refactor(programs): absorb addProductsToCart into ProgramDetailModal, remove prop"
```

---

## Task 5: Update SettingsModal to use UserProfileContext

**Files:**

- Modify: `src/features/settings/SettingsModal.tsx`

SettingsModal currently receives `userProfile: UserProfile` and `setUserProfile: (p: UserProfile) => void` as props. These are replaced by a local form state initialised from `useUserProfile()` context. The Firestore save (`setDoc`) is replaced by `saveUserProfile` from context.

**Context from UserProfileContext.ts:**

```ts
export function useUserProfile(): UserProfileState {
  // returns { userProfile: UserProfile | null, saveUserProfile: (p: UserProfile) => Promise<void> }
}
```

- [ ] **Step 5.1: Add import for `useUserProfile`**

In `SettingsModal.tsx`, add to imports:

```tsx
import { useUserProfile } from '@/app/providers/UserProfileContext';
```

- [ ] **Step 5.2: Remove `userProfile` and `setUserProfile` from Props**

Change the `Props` type from:

```tsx
type Props = {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  setUserProfile: (p: UserProfile) => void;
  availableCategories: string[];
  setAvailableCategories: (setter: (prev: string[]) => string[]) => void;
  onCategoryRemoved: (cat: string) => void;
};
```

To:

```tsx
type Props = {
  isOpen: boolean;
  onClose: () => void;
  availableCategories: string[];
  setAvailableCategories: (setter: (prev: string[]) => string[]) => void;
  onCategoryRemoved: (cat: string) => void;
};
```

- [ ] **Step 5.3: Update function signature and add context + form state**

Change the function signature from:

```tsx
export function SettingsModal({
  isOpen,
  onClose,
  userProfile,
  setUserProfile,
  availableCategories,
  setAvailableCategories,
  onCategoryRemoved,
}: Props) {
  const { i18n } = useTranslation();
```

To:

```tsx
const DEFAULT_PROFILE: UserProfile = {
  name: '', age: 30, gender: 'female',
  currentWeight: 65, targetWeight: 60,
  targetCalories: 1800, targetProteins: 100, targetFats: 60, targetCarbs: 200,
  waterGoal: 2000, allergies: [],
};

export function SettingsModal({
  isOpen,
  onClose,
  availableCategories,
  setAvailableCategories,
  onCategoryRemoved,
}: Props) {
  const { i18n } = useTranslation();
  const { userProfile: contextProfile, saveUserProfile } = useUserProfile();
  const [userProfile, setUserProfile] = useState<UserProfile>(contextProfile ?? DEFAULT_PROFILE);
```

> **Note:** `DEFAULT_PROFILE` is a module-level const, not inside the function.

- [ ] **Step 5.4: Add `useEffect` to sync form from context on open**

After the `useState` line, add:

```tsx
useEffect(() => {
  if (contextProfile) setUserProfile(contextProfile);
}, [contextProfile]);
```

- [ ] **Step 5.5: Replace `handleSaveSettings` body**

Current:

```tsx
const handleSaveSettings = async () => {
  try {
    await setDoc(doc(db, 'settings', 'profile'), userProfile);
    onClose();
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Не удалось сохранить настройки');
  }
};
```

Replace with:

```tsx
const handleSaveSettings = async () => {
  try {
    await saveUserProfile(userProfile);
    onClose();
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Не удалось сохранить настройки');
  }
};
```

- [ ] **Step 5.6: Remove now-unused imports from SettingsModal**

Remove `setDoc` and `doc` from the firebase import line (and `db` if it's no longer used):

```tsx
// Before:
import { setDoc, doc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';

// After: remove both lines entirely (saveUserProfile handles Firestore internally)
```

Also remove `UserProfile` from the type import if it's no longer used directly:

```tsx
// Check: UserProfile is still used for the form state type annotation
// Keep: import type { UserProfile } from '@/shared/domain/types';
```

- [ ] **Step 5.7: Verify TypeScript and tests**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npx tsc --noEmit 2>&1 | head -20 && npx vitest run 2>&1 | tail -10
```

Expected: 0 errors, all tests pass.

- [ ] **Step 5.8: Commit**

```bash
git add src/features/settings/SettingsModal.tsx
git commit -m "refactor(settings): SettingsModal uses useUserProfile() context directly"
```

---

## Task 6: Create AppHeader component

**Files:**

- Create: `src/app/layout/AppHeader.tsx`

This component wraps the 77-line header block from App.tsx. Language switcher state becomes internal. The settings button calls an `onOpenSettings` callback from App.tsx (so `isSettingsOpen` and `SettingsModal` stay in App.tsx; RecipesView's `onOpenSettings` prop can also call the same callback).

- [ ] **Step 6.1: Create the file**

```tsx
// src/app/layout/AppHeader.tsx
import React, { useState } from 'react';
import { BookOpen, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AppHeaderProps = {
  onOpenSettings: () => void;
};

export function AppHeader({ onOpenSettings }: AppHeaderProps) {
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<'ru' | 'de' | 'en'>('ru');

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-zinc-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-auto py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-200">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight font-display">Рецепт Менеджер</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                className="p-2 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center min-w-[40px]"
              >
                <span className="text-lg">
                  {currentLanguage === 'ru' ? '🇷🇺' : currentLanguage === 'de' ? '🇩🇪' : '🇺🇸'}
                </span>
              </button>
              <AnimatePresence>
                {isLanguageDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsLanguageDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-32 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-50"
                    >
                      <button
                        onClick={() => {
                          setCurrentLanguage('ru');
                          setIsLanguageDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full px-4 py-3 text-left text-sm font-bold flex items-center gap-3 hover:bg-zinc-50 transition-colors',
                          currentLanguage === 'ru'
                            ? 'text-emerald-600 bg-emerald-50/50'
                            : 'text-zinc-600',
                        )}
                      >
                        <span>🇷🇺</span> Русский
                      </button>
                      <button
                        onClick={() => {
                          setCurrentLanguage('de');
                          setIsLanguageDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full px-4 py-3 text-left text-sm font-bold flex items-center gap-3 hover:bg-zinc-50 transition-colors',
                          currentLanguage === 'de'
                            ? 'text-emerald-600 bg-emerald-50/50'
                            : 'text-zinc-600',
                        )}
                      >
                        <span>🇩🇪</span> Deutsch
                      </button>
                      <button
                        onClick={() => {
                          setCurrentLanguage('en');
                          setIsLanguageDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full px-4 py-3 text-left text-sm font-bold flex items-center gap-3 hover:bg-zinc-50 transition-colors',
                          currentLanguage === 'en'
                            ? 'text-emerald-600 bg-emerald-50/50'
                            : 'text-zinc-600',
                        )}
                      >
                        <span>🇺🇸</span> English
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={onOpenSettings}
              className="p-2 bg-zinc-100 text-zinc-600 rounded-xl hover:bg-zinc-200 transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 6.2: Verify TypeScript**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 6.3: Commit**

```bash
git add src/app/layout/AppHeader.tsx
git commit -m "feat(layout): add AppHeader component — extracts header JSX and language state"
```

---

## Task 7: Create RecipeSelectionBar component

**Files:**

- Create: `src/app/layout/RecipeSelectionBar.tsx`

The floating bar (42 lines in App.tsx) becomes a standalone component.

- [ ] **Step 7.1: Create the file**

```tsx
// src/app/layout/RecipeSelectionBar.tsx
import React from 'react';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type RecipeSelectionBarProps = {
  isVisible: boolean;
  selectedCount: number;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export function RecipeSelectionBar({
  isVisible,
  selectedCount,
  onCancel,
  onConfirm,
}: RecipeSelectionBarProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          className="fixed bottom-24 left-4 right-4 z-50 flex justify-center"
        >
          <div className="bg-zinc-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-xl">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Выбрано
              </span>
              <span className="text-xl font-bold text-emerald-400">{selectedCount} рецептов</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                className="px-6 py-2.5 rounded-xl font-bold text-zinc-400 hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => void onConfirm()}
                disabled={selectedCount === 0}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>Добавить</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 7.2: Verify TypeScript**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 7.3: Commit**

```bash
git add src/app/layout/RecipeSelectionBar.tsx
git commit -m "feat(layout): add RecipeSelectionBar component"
```

---

## Task 8: Update App.tsx — switch to context, use new layout components

**Files:**

- Modify: `src/App.tsx`

This task consolidates all removals. Each sub-step targets a distinct section to minimise risk.

**What App.tsx currently imports (relevant to this task):**

- pdfjs: `import * as pdfjs from 'pdfjs-dist'` and `import pdfjsWorker from '...'` → remove both
- firebase: `collection, addDoc, updateDoc, doc, onSnapshot, query, getDoc` → remove `onSnapshot`, `query`, `addDoc` (if `addProductsToCart` is gone)
- types: `CartItem, Tab, Recipe, UserProfile, Program` → remove `CartItem`, `UserProfile`; keep the rest
- `isStaple` → remove (no longer used after `addProductsToCart` moved)

**Context already in App.tsx:** `useNutritionPlan` is imported and `const { activeNutritionPlan } = useNutritionPlan()` is called. We will also add `useUserProfile` and extend `useData()`.

**DEFAULT_PROFILE** needed because `useUserProfile()` returns `UserProfile | null`. Components that receive `userProfile` as a prop expect `UserProfile` (non-null).

- [ ] **Step 8.1: Remove pdfjs imports and `extractImageFromPDF` / `extractTextFromPDF`**

Delete these two import lines (near the top of the file):

```tsx
import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
```

Delete the worker setup line:

```tsx
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
```

Delete the entire `extractImageFromPDF` function (~35 lines starting with `const extractImageFromPDF = async (`).

Delete the entire `extractTextFromPDF` function (~11 lines starting with `const extractTextFromPDF = async (`).

- [ ] **Step 8.2: Remove `const [recipes, setRecipes]` and its `onSnapshot` useEffect**

Delete:

```tsx
const [recipes, setRecipes] = useState<Recipe[]>([]);
```

Delete the useEffect block:

```tsx
useEffect(() => {
  const q = query(collection(db, 'recipes'));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const recipesData: Recipe[] = [];
    querySnapshot.forEach((doc) => {
      recipesData.push({ id: doc.id, ...doc.data() } as Recipe);
    });
    setRecipes(recipesData);
  });
  return () => unsubscribe();
}, []);
```

- [ ] **Step 8.3: Remove `const [cart, setCart]` and its `onSnapshot` useEffect**

Delete:

```tsx
const [cart, setCart] = useState<CartItem[]>([]);
```

Delete the useEffect block:

```tsx
useEffect(() => {
  const q = query(collection(db, 'cart'));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const cartData: CartItem[] = [];
    querySnapshot.forEach((doc) => {
      cartData.push({ id: doc.id, ...doc.data() } as CartItem);
    });
    setCart(
      cartData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    );
  });
  return () => unsubscribe();
}, []);
```

- [ ] **Step 8.4: Remove `const [userProfile, setUserProfile]` init block and its `onSnapshot` useEffect**

Delete the useState block (~13 lines):

```tsx
const [userProfile, setUserProfile] = useState<UserProfile>({
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
});
```

Delete the useEffect block (~8 lines):

```tsx
useEffect(() => {
  const unsubscribe = onSnapshot(doc(db, 'settings', 'profile'), (doc) => {
    if (doc.exists()) {
      setUserProfile(doc.data() as UserProfile);
    }
  });
  return () => unsubscribe();
}, []);
```

- [ ] **Step 8.5: Remove `isLanguageDropdownOpen` and `currentLanguage` state**

Delete:

```tsx
const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
const [currentLanguage, setCurrentLanguage] = useState<'ru' | 'de' | 'en'>('ru');
```

- [ ] **Step 8.6: Remove `addProductsToCart` function**

Delete the entire function (~25 lines):

```tsx
  const addProductsToCart = async (products: string[]) => {
    ...
  };
```

- [ ] **Step 8.7: Add `DEFAULT_PROFILE` constant and switch to context reads**

Add `DEFAULT_PROFILE` above the `App` function (before `export default function App()`):

```tsx
const DEFAULT_PROFILE: UserProfile = {
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
};
```

Inside the App function, find the current `useData` and `useNutritionPlan` lines:

```tsx
const { activeNutritionPlan } = useNutritionPlan();
const { programs } = useData();
```

Replace with:

```tsx
const { activeNutritionPlan } = useNutritionPlan();
const { userProfile: contextProfile } = useUserProfile();
const userProfile = contextProfile ?? DEFAULT_PROFILE;
const { recipes, cartItems, programs } = useData();
```

- [ ] **Step 8.8: Add new imports and update UserProfileContext import**

Add two new import lines:

```tsx
import { AppHeader } from '@/app/layout/AppHeader';
import { RecipeSelectionBar } from '@/app/layout/RecipeSelectionBar';
```

Find the existing UserProfileContext import (currently `useNutritionPlan` only):

```tsx
import { useNutritionPlan } from '@/app/providers/UserProfileContext';
```

Replace with:

```tsx
import { useNutritionPlan, useUserProfile } from '@/app/providers/UserProfileContext';
```

- [ ] **Step 8.10: Update firebase imports — remove now-unused names**

Find the firebase import line:

```tsx
import { collection, addDoc, updateDoc, doc, onSnapshot, query, getDoc } from 'firebase/firestore';
```

Remove `collection`, `addDoc`, `onSnapshot`, `query` — all are now gone from App.tsx (`addProductsToCart` and all three onSnapshot subscriptions removed):

```tsx
import { updateDoc, doc, getDoc } from 'firebase/firestore';
```

> **Note:** `updateDoc`/`doc` are still needed for `handleAddSelectedRecipes`. `getDoc` for the URL share handler.

- [ ] **Step 8.11: Remove unused type imports**

Find:

```tsx
import type { CartItem, Tab, Recipe, UserProfile, Program } from '@/shared/domain/types';
```

Remove `CartItem` and `UserProfile` (no longer used directly by App):

```tsx
import type { Tab, Recipe, Program } from '@/shared/domain/types';
```

> **Note:** `Recipe` is still needed for `selectedRecipe: Recipe | null`. `Program` is still needed for the URL handler `getDoc` cast. `Tab` for `activeTab`.

- [ ] **Step 8.12: Remove `isStaple` import**

Delete:

```tsx
import { isStaple } from '@/features/cart/services/staples';
```

- [ ] **Step 8.13: Update `renderContent()` — fix CartView and ProgramsView props**

In `renderContent()`:

Change `case 'cart'` to use `cartItems` instead of `cart`:

```tsx
      case 'cart':
        return <CartView cart={cartItems} />;
```

Remove `onAddProductsToCart` from the `case 'programs'` block:

```tsx
      case 'programs':
        return (
          <ProgramsView
            recipes={recipes}
            availableCategories={availableCategories}
            userProfile={userProfile}
            openProgramId={openProgramId}
            onOpenProgramIdChange={setOpenProgramId}
            isRecipeSelectionMode={isRecipeSelectionMode}
            selectionTarget={selectionTarget}
            selectedRecipeIds={selectedRecipeIds}
            onSelectedRecipeIdsChange={setSelectedRecipeIds}
            onStartRecipeSelection={handleStartRecipeSelection}
            onAddSelectedRecipes={handleAddSelectedRecipes}
            recipeTarget={recipeTarget}
            onRecipeTargetCleared={() => setRecipeTarget(null)}
            onRecipeTargetSet={setRecipeTarget}
            photoInputRef={photoInputRef}
            isAddingManual={isAddingManual} onIsAddingManualChange={setIsAddingManual}
            isAddingLink={isAddingLink} onIsAddingLinkChange={setIsAddingLink}
            isAddingPDF={isAddingPDF} onIsAddingPDFChange={setIsAddingPDF}
            isScanning={isScanning} onIsScanningChange={setIsScanning}
            onSelectRecipe={setSelectedRecipe}
          />
        );
```

(Notice `onAddProductsToCart` is gone from this block.)

- [ ] **Step 8.14: Replace header JSX with AppHeader + RecipeSelectionBar in the return**

In the `return (...)` block of App:

Replace the entire `<header>...</header>` block (77 lines) with:

```tsx
<AppHeader onOpenSettings={() => setIsSettingsOpen(true)} />
```

Replace the entire `<AnimatePresence>` block that was the RecipeSelectionBar (42 lines) with:

```tsx
<RecipeSelectionBar
  isVisible={isRecipeSelectionMode}
  selectedCount={selectedRecipeIds.length}
  onCancel={() => {
    setIsRecipeSelectionMode(false);
    setSelectionTarget(null);
    setSelectedRecipeIds([]);
    if (selectionTarget?.programId) setOpenProgramId(selectionTarget.programId);
  }}
  onConfirm={handleAddSelectedRecipes}
/>
```

Update the `<SettingsModal>` call (remove `userProfile` and `setUserProfile` props):

```tsx
<SettingsModal
  isOpen={isSettingsOpen}
  onClose={() => setIsSettingsOpen(false)}
  availableCategories={availableCategories}
  setAvailableCategories={setAvailableCategories}
  onCategoryRemoved={() => {}}
/>
```

- [ ] **Step 8.15: Verify TypeScript**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors. Fix any that appear (likely unused variable warnings or missing prop).

- [ ] **Step 8.16: Run full test suite**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npx vitest run 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 8.17: Check App.tsx line count**

```bash
wc -l /Users/evidenee/Flowgence/Rezept_Manager/src/App.tsx
```

Expected: approximately 280–320 lines (down from 540).

- [ ] **Step 8.18: Run build**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npm run build 2>&1 | tail -15
```

Expected: successful build.

- [ ] **Step 8.19: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(app): remove duplicate subscriptions, extract layout components, switch to context"
```

---

## Done Criteria

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx vitest run` — all tests pass
- [ ] `npm run build` — green
- [ ] `wc -l src/App.tsx` — under 320 lines
- [ ] `grep -rn "extractImageFromPDF\|extractTextFromPDF" src/` — 0 local definitions; only import from pdfUtils
- [ ] `grep -n "onSnapshot" src/App.tsx` — 0 matches
- [ ] `addProductsToCart` absent from App.tsx
- [ ] Tracker + Planner tabs function correctly in browser (KBZHU sync preserved)
