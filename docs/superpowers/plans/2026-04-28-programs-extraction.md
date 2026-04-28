# Programs Tab Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Programs tab from App.tsx (~2700 lines) into `src/features/programs/ProgramsView.tsx` + `ProgramDetailModal.tsx`, eliminating the duplicate Firestore `programs` subscription.

**Architecture:** ProgramsView reads `programs` via `useData()` (DataContext). App.tsx removes its own onSnapshot for programs and also switches to `useData()` so `handleStartRecipeSelection` / `handleAddSelectedRecipes` still work. `openProgramId` stays as a controlled prop in App.tsx (same pattern as `selectedRecipe` in RecipesView). All Firestore writes stay as direct `addDoc/updateDoc/deleteDoc` calls inside the new components.

**Tech Stack:** React 19, TypeScript strict, Firebase Firestore, motion/react, lucide-react, pdfjs-dist, clsx/tailwind-merge

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/features/programs/ProgramDetailModal.tsx` | Create | Full-screen program detail overlay: subfolders, recipe DnD, edit entity, resource management |
| `src/features/programs/ProgramsView.tsx` | Create | Program card grid, create/edit form modal, delete confirm, mounts ProgramDetailModal |
| `src/App.tsx` | Modify | Remove Programs-specific code, switch to `useData()`, add ProgramsView to renderContent |
| `ROADMAP.md` | Modify | Mark step complete, update next step |

---

## Task 1: Create ProgramDetailModal.tsx skeleton

**Files:**
- Create: `src/features/programs/ProgramDetailModal.tsx`

- [ ] **Step 1: Create the file with imports, helpers, prop types, and state — returns null for now**

```tsx
import React, { useState } from 'react';
import {
  ChevronLeft, Plus, Edit2, Edit3, Trash2, FolderPlus,
  BookOpen, Camera, FileText, Link as LinkIcon, Activity,
  ChevronDown, Upload, ShoppingCart,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { Program, Recipe, Resource } from '@/shared/domain/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function AddRecipeOption({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-3 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

export type ProgramDetailModalProps = {
  program: Program;
  recipes: Recipe[];
  availableCategories: string[];
  programRecipeFilter: string;
  onProgramRecipeFilterChange: (f: string) => void;
  onClose: () => void;
  onDeleteProgram: (program: Program) => void;
  onStartRecipeSelection: (programId: string, subfolderId: string | 'main') => void;
  onRecipeTargetSet: (target: { programId: string; subfolderId: string | 'main' }) => void;
  recipeTarget: { programId: string; subfolderId: string | 'main' } | null;
  onRecipeTargetCleared: () => void;
  photoInputRef: React.RefObject<HTMLInputElement>;
  isAddingManual: boolean; onIsAddingManualChange: (v: boolean) => void;
  isAddingLink: boolean;   onIsAddingLinkChange: (v: boolean) => void;
  isAddingPDF: boolean;    onIsAddingPDFChange: (v: boolean) => void;
  isScanning: boolean;     onIsScanningChange: (v: boolean) => void;
  onAddProductsToCart: (products: string[]) => void;
};

export function ProgramDetailModal(props: ProgramDetailModalProps) {
  const {
    program, recipes, availableCategories, programRecipeFilter,
    onProgramRecipeFilterChange, onClose, onDeleteProgram,
    onStartRecipeSelection, onRecipeTargetSet, photoInputRef,
    isAddingManual, onIsAddingManualChange,
    isAddingLink, onIsAddingLinkChange,
    isAddingPDF, onIsAddingPDFChange,
    onAddProductsToCart,
  } = props;

  const [openSubfolderId, setOpenSubfolderId] = useState<string | null>(null);
  const [editingSubfolderId, setEditingSubfolderId] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<{
    type: 'program' | 'subfolder';
    id: string;
    programId?: string;
  } | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '', description: '',
    targetCalories: 0, targetProteins: 0, targetFats: 0, targetCarbs: 0,
    resources: [] as Resource[],
    allowedProducts: [] as string[],
    forbiddenProducts: [] as string[],
  });
  const [programAddRecipeDropdown, setProgramAddRecipeDropdown] = useState<{
    programId: string;
    subfolderId: string | 'main';
  } | null>(null);
  const [subfolderToDelete, setSubfolderToDelete] = useState<{
    programId: string;
    subfolderId: string;
    name: string;
  } | null>(null);
  const [showProducts, setShowProducts] = useState(false);
  const [activeResourceForm, setActiveResourceForm] = useState<{
    targetId: string;
    type: 'link' | 'pdf';
  } | null>(null);
  const [resourceFormData, setResourceFormData] = useState({
    url: '', title: '', description: '',
  });
  const subfolderPdfInputRef = React.useRef<HTMLInputElement>(null);

  // placeholder — full JSX added in Task 2
  return null;
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npm run build 2>&1 | tail -10
```

Expected: 0 errors (component returns null, not yet mounted)

---

## Task 2: Add handlers and full JSX to ProgramDetailModal

**Files:**
- Modify: `src/features/programs/ProgramDetailModal.tsx`

- [ ] **Step 1: Add handlers inside the component body, before `return null`**

```tsx
  const handleDropRecipe = async (
    recipeId: string,
    targetSubfolderId: string,
    sourceSubfolderId: string,
  ) => {
    if (targetSubfolderId === sourceSubfolderId) return;
    let newRecipeIds = [...program.recipeIds];
    let newSubfolders = program.subfolders ? [...program.subfolders] : [];

    if (sourceSubfolderId === 'main') {
      newRecipeIds = newRecipeIds.filter(id => id !== recipeId);
    } else {
      newSubfolders = newSubfolders.map(sf =>
        sf.id === sourceSubfolderId
          ? { ...sf, recipeIds: sf.recipeIds.filter(id => id !== recipeId) }
          : sf
      );
    }
    if (targetSubfolderId === 'main') {
      if (!newRecipeIds.includes(recipeId)) newRecipeIds.push(recipeId);
    } else {
      newSubfolders = newSubfolders.map(sf =>
        sf.id === targetSubfolderId
          ? { ...sf, recipeIds: [...sf.recipeIds, recipeId] }
          : sf
      );
    }
    try {
      await updateDoc(doc(db, 'programs', program.id), {
        recipeIds: newRecipeIds,
        subfolders: newSubfolders,
      });
    } catch (error) {
      console.error('Error moving recipe:', error);
    }
  };

  const handleSubfolderPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const newResource: Resource = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'pdf',
      url: file.name,
      title: file.name,
      description: '',
    };
    if (editingEntity) {
      setEditFormData(prev => ({ ...prev, resources: [...prev.resources, newResource] }));
      alert(`Файл ${file.name} добавлен`);
      return;
    }
    if (activeResourceForm) {
      if (activeResourceForm.targetId === 'main') {
        updateDoc(doc(db, 'programs', program.id), {
          resources: [...(program.resources || []), newResource],
        });
      } else {
        const newSubfolders = program.subfolders?.map(sf =>
          sf.id === activeResourceForm.targetId
            ? { ...sf, resources: [...(sf.resources || []), newResource] }
            : sf
        );
        updateDoc(doc(db, 'programs', program.id), { subfolders: newSubfolders });
      }
      setActiveResourceForm(null);
      alert(`Файл ${file.name} загружен`);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEntity) return;
    try {
      if (editingEntity.type === 'program') {
        await updateDoc(doc(db, 'programs', editingEntity.id), {
          name: editFormData.name,
          description: editFormData.description,
          targetCalories: editFormData.targetCalories,
          targetProteins: editFormData.targetProteins,
          targetFats: editFormData.targetFats,
          targetCarbs: editFormData.targetCarbs,
          resources: editFormData.resources,
          allowedProducts: editFormData.allowedProducts,
          forbiddenProducts: editFormData.forbiddenProducts,
        });
      } else {
        const newSubfolders = program.subfolders?.map(sf =>
          sf.id === editingEntity.id
            ? {
                ...sf,
                name: editFormData.name,
                description: editFormData.description,
                targetCalories: editFormData.targetCalories,
                targetProteins: editFormData.targetProteins,
                targetFats: editFormData.targetFats,
                targetCarbs: editFormData.targetCarbs,
                resources: editFormData.resources,
                allowedProducts: editFormData.allowedProducts,
                forbiddenProducts: editFormData.forbiddenProducts,
              }
            : sf
        );
        await updateDoc(doc(db, 'programs', editingEntity.programId!), {
          subfolders: newSubfolders,
        });
      }
      setEditingEntity(null);
    } catch (error) {
      console.error('Error saving edit:', error);
      alert('Ошибка при сохранении');
    }
  };
```

- [ ] **Step 2: Replace `return null` with the full JSX**

Replace `return null;` with the JSX extracted from App.tsx. The JSX comes from two App.tsx regions; merge them into one return statement:

**Region A — Modal wrapper + header** (App.tsx lines 2728–2987):
Copy the `<div className="fixed inset-0 z-[90]...">` block. Apply these substitutions:

| App.tsx | ProgramDetailModal |
|---|---|
| `activeCollectionId` | `program.id` |
| `programs.find(p => p.id === activeCollectionId)` | `program` |
| `programs.find(p => p.id === activeCollectionId)?.name` | `program.name` |
| `programs.find(p => p.id === activeCollectionId)?.description` | `program.description` |
| `setActiveCollectionId(null)` | `onClose()` |
| `setProgramToDelete(program)` | `onDeleteProgram(program)` |
| `handleStartRecipeSelection(activeCollectionId!, 'main')` | `onStartRecipeSelection(program.id, 'main')` |
| `setRecipeTarget({ programId: activeCollectionId!, subfolderId: 'main' })` | `onRecipeTargetSet({ programId: program.id, subfolderId: 'main' })` |
| `setIsAddingPDF(true)` | `onIsAddingPDFChange(true)` |
| `setIsAddingLink(true)` | `onIsAddingLinkChange(true)` |
| `setIsAddingManual(true)` | `onIsAddingManualChange(true)` |
| `photoInputRef.current?.click()` | `photoInputRef.current?.click()` (unchanged) |
| `programRecipeFilter` | `programRecipeFilter` (from prop) |
| `setProgramRecipeFilter` | `onProgramRecipeFilterChange` |
| `addProductsToCart(...)` | `onAddProductsToCart(...)` |
| `setEditingEntity(...)` + `setEditFormData(...)` | `setEditingEntity(...)` + `setEditFormData(...)` (internal state) |
| `showProducts` / `setShowProducts` | internal state |
| `programAddRecipeDropdown` / `setProgramAddRecipeDropdown` | internal state |

**Region B — Modal body content** (App.tsx lines 2988–4086):
Copy the `<div className="p-6 overflow-y-auto...">` block. Apply same substitutions. Additionally:
- For subfolder `setRecipeTarget(...)` calls: `onRecipeTargetSet({ programId: program.id, subfolderId: subfolder.id })`
- For subfolder `handleStartRecipeSelection(program.id, subfolder.id)`: `onStartRecipeSelection(program.id, subfolder.id)`
- `handleDropRecipe(recipeId, subfolder.id, sourceSubfolderId, program.id)` → `handleDropRecipe(recipeId, subfolder.id, sourceSubfolderId)` (programId no longer a param — use `program.id` directly inside the handler)
- `openSubfolderId` / `setOpenSubfolderId` → internal state
- `editingSubfolderId` / `setEditingSubfolderId` → internal state

**Region C — edit entity modal, resource form, subfolder delete confirm** (App.tsx lines 3820–4086 + 4252–4302):
Move these modals inside the return. Apply same substitutions. The subfolder delete confirm was at App level (lines 4252–4302) — it now uses internal `subfolderToDelete` state and calls `setSubfolderToDelete(null)` / `setEditingSubfolderId(null)`.

Also add the hidden `subfolderPdfInputRef` input at the end:
```tsx
<input
  type="file"
  ref={subfolderPdfInputRef}
  className="hidden"
  accept="application/pdf"
  onChange={handleSubfolderPdfUpload}
/>
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npm run build 2>&1 | tail -20
```

Expected: 0 TS errors

- [ ] **Step 4: Commit**

```bash
git add src/features/programs/ProgramDetailModal.tsx
git commit -m "feat(programs): add ProgramDetailModal component"
```

---

## Task 3: Create ProgramsView.tsx

**Files:**
- Create: `src/features/programs/ProgramsView.tsx`

- [ ] **Step 1: Create file with imports, helpers, types, state, and handlers**

```tsx
import React, { useState } from 'react';
import {
  BookOpen, Plus, Edit3, FileText, Trash2, Share2,
  FolderPlus, Users, Link as LinkIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import { aiClient } from '@/services/ai/aiClient';
import * as pdfjs from 'pdfjs-dist';
import { useData } from '@/app/providers/DataContext';
import { ProgramDetailModal } from '@/features/programs/ProgramDetailModal';
import type { Program, Recipe, UserProfile, Subfolder } from '@/shared/domain/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function AddRecipeOption({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-3 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

const extractImageFromPDF = async (
  pdfData: string,
  pageNumber: number,
  box: { ymin: number; xmin: number; ymax: number; xmax: number },
): Promise<string> => {
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
};

const extractTextFromPDF = async (pdfData: string): Promise<string> => {
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
};

export type ProgramsViewProps = {
  recipes: Recipe[];
  availableCategories: string[];
  userProfile: UserProfile;
  openProgramId: string | null;
  onOpenProgramIdChange: (id: string | null) => void;
  isRecipeSelectionMode: boolean;
  selectionTarget: { programId: string; subfolderId: string | 'main' } | null;
  selectedRecipeIds: string[];
  onSelectedRecipeIdsChange: (ids: string[]) => void;
  onStartRecipeSelection: (programId: string, subfolderId: string | 'main') => void;
  onAddSelectedRecipes: () => Promise<void>;
  recipeTarget: { programId: string; subfolderId: string | 'main' } | null;
  onRecipeTargetCleared: () => void;
  onRecipeTargetSet: (target: { programId: string; subfolderId: string | 'main' }) => void;
  photoInputRef: React.RefObject<HTMLInputElement>;
  isAddingManual: boolean; onIsAddingManualChange: (v: boolean) => void;
  isAddingLink: boolean;   onIsAddingLinkChange: (v: boolean) => void;
  isAddingPDF: boolean;    onIsAddingPDFChange: (v: boolean) => void;
  isScanning: boolean;     onIsScanningChange: (v: boolean) => void;
  onAddProductsToCart: (products: string[]) => void;
};

const emptyProgramForm = {
  name: '', description: '', creator: '', link: '',
  recipeIds: [] as string[], image: '', pdfUrl: '',
  subfolders: [] as Subfolder[],
  allowedProducts: [] as string[],
  forbiddenProducts: [] as string[],
};

export function ProgramsView(props: ProgramsViewProps) {
  const {
    recipes, availableCategories, openProgramId, onOpenProgramIdChange,
    onStartRecipeSelection, recipeTarget, onRecipeTargetCleared, onRecipeTargetSet,
    photoInputRef, isAddingManual, onIsAddingManualChange,
    isAddingLink, onIsAddingLinkChange, isAddingPDF, onIsAddingPDFChange,
    isScanning, onIsScanningChange, onAddProductsToCart,
  } = props;

  const { programs } = useData();

  const [programFormData, setProgramFormData] = useState({ ...emptyProgramForm });
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [isCreatingProgram, setIsCreatingProgram] = useState(false);
  const [isCreateProgramDropdownOpen, setIsCreateProgramDropdownOpen] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null);
  const [programRecipeFilter, setProgramRecipeFilter] = useState('Все');
  const [subfolderRecipeFilters, setSubfolderRecipeFilters] = useState<Record<string, string>>({});
  const [editingSubfolderId, setEditingSubfolderId] = useState<string | null>(null);

  const programPhotoInputRef = React.useRef<HTMLInputElement>(null);
  const programPdfInputRef = React.useRef<HTMLInputElement>(null);
  const subfolderPhotoInputRef = React.useRef<HTMLInputElement>(null);

  const handleProgramPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProgramFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubfolderPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingSubfolderId) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProgramFormData(prev => ({
          ...prev,
          subfolders: prev.subfolders.map(sf =>
            sf.id === editingSubfolderId
              ? { ...sf, image: reader.result as string }
              : sf
          ),
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProgramPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onIsScanningChange(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1] ?? '';
      try {
        const isLarge = base64.length > 20_000_000;
        const request = isLarge
          ? { pdfText: await extractTextFromPDF(base64), availableCategories }
          : { pdfBase64: base64, availableCategories };
        const result = await aiClient.importFromPdf(request);
        const recipeIds: string[] = [];
        for (const r of result.recipes) {
          let dishImage: string | null = null;
          if (r.pageNumber && r.dishBoundingBox) {
            const extracted = await extractImageFromPDF(base64, r.pageNumber, r.dishBoundingBox);
            if (extracted) dishImage = extracted;
          }
          if (!dishImage) {
            const generated = await aiClient.generateImage({ title: r.title, ingredients: r.ingredients });
            if (generated?.imageDataUri) dishImage = generated.imageDataUri;
          }
          const imageToStore = dishImage && dishImage.length <= 800_000 ? dishImage : null;
          const docRef = await addDoc(collection(db, 'recipes'), {
            title: r.title, author: r.author ?? '', image: imageToStore,
            time: r.time, servings: r.servings, categories: r.categories,
            ingredients: r.ingredients, steps: r.steps, macros: r.macros,
            isFavorite: false, createdAt: new Date().toISOString(),
          });
          recipeIds.push(docRef.id);
        }
        const inferredName = file.name.replace(/\.pdf$/i, '');
        setProgramFormData(prev => ({
          ...prev,
          name: prev.name || inferredName,
          recipeIds,
          pdfUrl: file.name,
        }));
        alert(`Извлечено рецептов: ${result.recipes.length}. Проверьте название и сохраните программу.`);
      } catch (error) {
        console.error('Error analyzing PDF for program:', error);
        alert('Не удалось распознать PDF. Попробуйте другой файл.');
      } finally {
        onIsScanningChange(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programFormData.name) return;
    try {
      if (editingProgramId) {
        await updateDoc(doc(db, 'programs', editingProgramId), {
          ...programFormData,
          updatedAt: new Date().toISOString(),
        });
        alert('Программа обновлена');
      } else {
        await addDoc(collection(db, 'programs'), {
          ...programFormData,
          createdAt: new Date().toISOString(),
        });
        alert('Программа создана');
      }
      setIsCreatingProgram(false);
      setEditingProgramId(null);
      setProgramFormData({ ...emptyProgramForm });
    } catch (error) {
      console.error('Error saving program:', error);
      alert('Ошибка при сохранении программы');
    }
  };

  const handleShareProgram = (programId: string) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?programId=${programId}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Ссылка скопирована в буфер обмена!');
  };

  const openProgram = openProgramId ? (programs.find(p => p.id === openProgramId) ?? null) : null;

  return (
    <>
      {/* Programs list JSX: copy App.tsx lines 1658–2318 (renderPrograms body) with substitutions below */}
      {/* Substitutions:
          activeCollectionId / setActiveCollectionId  → openProgramId / onOpenProgramIdChange
          All internal state/handlers as named above
          programPhotoInputRef / programPdfInputRef / subfolderPhotoInputRef → internal refs
      */}

      {/* Hidden file inputs */}
      <input type="file" ref={programPhotoInputRef} className="hidden" accept="image/*" onChange={handleProgramPhotoUpload} />
      <input type="file" ref={programPdfInputRef} className="hidden" accept="application/pdf" onChange={handleProgramPdfUpload} />
      <input type="file" ref={subfolderPhotoInputRef} className="hidden" accept="image/*" onChange={handleSubfolderPhotoUpload} />

      {/* Program delete confirmation — copy App.tsx lines 4201–4249 */}
      {/* Use internal programToDelete; on confirm: deleteDoc + onOpenProgramIdChange(null) + setProgramToDelete(null) */}
      <AnimatePresence>
        {programToDelete && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setProgramToDelete(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold mb-2">Удалить программу?</h3>
              <p className="text-zinc-500 text-sm mb-6">
                Действительно хочешь удалить программу{' '}
                <span className="font-bold text-zinc-900">"{programToDelete.name}"</span>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setProgramToDelete(null)}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={async () => {
                    try {
                      await deleteDoc(doc(db, 'programs', programToDelete.id));
                      setProgramToDelete(null);
                      onOpenProgramIdChange(null);
                    } catch (err) {
                      console.error('Error deleting program:', err);
                    }
                  }}
                  className="flex-1 py-3 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-lg"
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ProgramDetailModal */}
      <AnimatePresence>
        {openProgram && (
          <ProgramDetailModal
            program={openProgram}
            recipes={recipes}
            availableCategories={availableCategories}
            programRecipeFilter={programRecipeFilter}
            onProgramRecipeFilterChange={setProgramRecipeFilter}
            onClose={() => onOpenProgramIdChange(null)}
            onDeleteProgram={setProgramToDelete}
            onStartRecipeSelection={onStartRecipeSelection}
            onRecipeTargetSet={onRecipeTargetSet}
            recipeTarget={recipeTarget}
            onRecipeTargetCleared={onRecipeTargetCleared}
            photoInputRef={photoInputRef}
            isAddingManual={isAddingManual} onIsAddingManualChange={onIsAddingManualChange}
            isAddingLink={isAddingLink} onIsAddingLinkChange={onIsAddingLinkChange}
            isAddingPDF={isAddingPDF} onIsAddingPDFChange={onIsAddingPDFChange}
            isScanning={isScanning} onIsScanningChange={onIsScanningChange}
            onAddProductsToCart={onAddProductsToCart}
          />
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2: Fill in the list JSX**

Replace the `{/* Programs list JSX: copy App.tsx lines 1658–2318 ... */}` comment with the actual JSX.

Open App.tsx and copy lines **1658–2318** (the full body of `renderPrograms()`, from the opening `<div className="max-w-7xl...">` through the closing `</div>` of the AnimatePresence for the create modal).

Apply these substitutions:
| App.tsx | ProgramsView |
|---|---|
| `setActiveCollectionId(program.id)` | `onOpenProgramIdChange(program.id)` |
| `isCreatingProgram` / `setIsCreatingProgram` | internal state |
| `editingProgramId` / `setEditingProgramId` | internal state |
| `programFormData` / `setProgramFormData` | internal state |
| `programRecipeFilter` / `setProgramRecipeFilter` | internal state |
| `subfolderRecipeFilters` / `setSubfolderRecipeFilters` | internal state |
| `editingSubfolderId` / `setEditingSubfolderId` | internal state |
| `isCreateProgramDropdownOpen` / `setIsCreateProgramDropdownOpen` | internal state |
| `setProgramToDelete` | internal state setter |
| `programPhotoInputRef` | internal ref |
| `programPdfInputRef` | internal ref |
| `subfolderPhotoInputRef` | internal ref |
| `handleCreateProgram` | internal handler |
| `handleShareProgram` | internal handler |
| `availableCategories` | prop |
| `recipes` | prop |

- [ ] **Step 3: Verify build**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npm run build 2>&1 | tail -20
```

Expected: 0 TS errors (ProgramsView and ProgramDetailModal both compile; ProgramsView not yet wired into App.tsx)

- [ ] **Step 4: Commit**

```bash
git add src/features/programs/ProgramsView.tsx
git commit -m "feat(programs): add ProgramsView component"
```

---

## Task 4: Update App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add new imports**

Add to the imports block at the top of App.tsx:

```tsx
import { useData } from '@/app/providers/DataContext';
import { ProgramsView } from '@/features/programs/ProgramsView';
```

- [ ] **Step 2: Rename activeCollectionId → openProgramId**

Find (line ~368):
```tsx
const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
```
Replace with:
```tsx
const [openProgramId, setOpenProgramId] = useState<string | null>(null);
```

- [ ] **Step 3: Remove programs onSnapshot and useState**

Remove `const [programs, setPrograms] = useState<Program[]>([]);` (line ~194).

Remove the entire `useEffect` for programs (lines ~525–535):
```tsx
useEffect(() => {
  const q = query(collection(db, "programs"));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const programsData: Program[] = [];
    querySnapshot.forEach((doc) => {
      programsData.push({ id: doc.id, ...doc.data() } as Program);
    });
    setPrograms(programsData);
  });
  return () => unsubscribe();
}, []);
```

Add inside the component body near the top (after the `useNutritionPlan` hook):
```tsx
const { programs } = useData();
```

- [ ] **Step 4: Update handleStartRecipeSelection**

Find `handleStartRecipeSelection` (~line 379) and replace `setActiveCollectionId(null)` with `setOpenProgramId(null)`:

```tsx
const handleStartRecipeSelection = (programId: string, subfolderId: string | 'main') => {
  setSelectionTarget({ programId, subfolderId });
  setIsRecipeSelectionMode(true);
  setSelectedRecipeIds([]);
  setActiveTab('recipes');
  setOpenProgramId(null);
};
```

- [ ] **Step 5: Update handleAddSelectedRecipes**

Find `handleAddSelectedRecipes` (~line 387) and replace `setActiveCollectionId(programId)` with `setOpenProgramId(programId)`:

```tsx
const handleAddSelectedRecipes = async () => {
  if (!selectionTarget) return;
  const { programId, subfolderId } = selectionTarget;
  const program = programs.find(p => p.id === programId);
  if (!program) return;
  try {
    if (subfolderId === 'main') {
      const newRecipeIds = Array.from(new Set([...program.recipeIds, ...selectedRecipeIds]));
      await updateDoc(doc(db, "programs", programId), { recipeIds: newRecipeIds });
    } else {
      const newSubfolders = program.subfolders?.map(sf => {
        if (sf.id === subfolderId) {
          return { ...sf, recipeIds: Array.from(new Set([...sf.recipeIds, ...selectedRecipeIds])) };
        }
        return sf;
      });
      await updateDoc(doc(db, "programs", programId), { subfolders: newSubfolders });
    }
    setIsRecipeSelectionMode(false);
    setSelectionTarget(null);
    setSelectedRecipeIds([]);
    setOpenProgramId(programId);
  } catch (error) {
    console.error("Error adding recipes:", error);
    alert("Не удалось добавить рецепты");
  }
};
```

- [ ] **Step 6: Update URL param handler**

Find `handleSharedProgram` (~line 478). Replace `setActiveCollectionId(programId)` with `setOpenProgramId(programId)`.

- [ ] **Step 7: Remove extracted Programs state declarations**

Remove these `useState` declarations from App.tsx (all now live in ProgramsView or ProgramDetailModal):
- `programFormData` / `setProgramFormData`
- `editingProgramId` / `setEditingProgramId`
- `isCreatingProgram` / `setIsCreatingProgram`
- `isCreateProgramDropdownOpen` / `setIsCreateProgramDropdownOpen`
- `programToDelete` / `setProgramToDelete`
- `subfolderToDelete` / `setSubfolderToDelete`
- `programRecipeFilter` / `setProgramRecipeFilter`
- `subfolderRecipeFilters` / `setSubfolderRecipeFilters`
- `editingSubfolderId` / `setEditingSubfolderId`
- `editingEntity` / `setEditingEntity`
- `editFormData` / `setEditFormData`
- `isEditingProgramInline` / `setIsEditingProgramInline`
- `programAddRecipeDropdown` / `setProgramAddRecipeDropdown`
- `openSubfolderId` / `setOpenSubfolderId`
- `showProducts` / `setShowProducts`
- `activeResourceForm` / `setActiveResourceForm`
- `resourceFormData` / `setResourceFormData`

Remove refs: `programPhotoInputRef`, `programPdfInputRef`, `subfolderPhotoInputRef`, `subfolderPdfInputRef`.

- [ ] **Step 8: Remove extracted handlers**

Remove these functions from App.tsx:
- `handleProgramPhotoUpload` (lines ~602–611)
- `handleProgramPdfUpload` (lines ~613–677)
- `handleSubfolderPdfUpload` (lines ~679–714)
- `handleSubfolderPhotoUpload` (lines ~716–730)
- `handleCreateProgram` (lines ~732–768)
- `handleShareProgram` (lines ~770–774)
- `handleDropRecipe` (lines ~808–843)

- [ ] **Step 9: Remove renderPrograms() and extracted JSX from return()**

- Remove `const renderPrograms = () => { ... }` function definition (lines ~1656–2319)
- In the `return (...)` block, remove:
  - The `{activeCollectionId && (...)}` detail modal AnimatePresence block (lines ~2726–4191)
  - The `<input ref={subfolderPdfInputRef} ...>` (lines ~4193–4199)
  - The `{programToDelete && (...)}` AnimatePresence block (lines ~4201–4249)
  - The `{subfolderToDelete && (...)}` AnimatePresence block (lines ~4252–4302)

- [ ] **Step 10: Wire up ProgramsView in renderContent()**

Replace `return renderPrograms();` in the programs case with:

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
      onAddProductsToCart={addProductsToCart}
    />
  );
```

- [ ] **Step 11: Build — fix any remaining TS errors**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npm run build 2>&1 | tail -40
```

Common errors to expect and fix:
- Unused imports in App.tsx (remove `FolderPlus`, `FolderHeart`, `Edit2` if no longer used)
- Leftover references to removed state (search for `setActiveCollectionId`, `programFormData`, etc.)
- Missing `onSnapshot` import can be removed if programs was the last subscriber using it in App.tsx

- [ ] **Step 12: Run tests**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager && npm run test 2>&1 | tail -20
```

Expected: all tests pass (97+ tests, 0 failures)

- [ ] **Step 13: Check App.tsx line count**

```bash
wc -l /Users/evidenee/Flowgence/Rezept_Manager/src/App.tsx
```

Expected: ~2000 lines or less (down from 4538)

- [ ] **Step 14: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(app): extract ProgramsView from App.tsx into src/features/programs/"
```

---

## Task 5: Update ROADMAP.md

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1: Mark Programs complete and update next step**

In `ROADMAP.md`, Phase 1 checklist, find:
```
- [ ] Programs (иерархия subfolders)
```
Change to:
```
- [x] Programs (иерархия subfolders)
```

Update "Следующий шаг":
```
Phase 1 Step 4 — вынос вкладки Planner из App.tsx в src/features/planner/
```

Update "Обновлено" to today's date.

Add to "Журнал решений":
```
- **2026-04-28** — Phase 1 Step 4 (Programs) завершена. ProgramsView + ProgramDetailModal извлечены в `src/features/programs/`. Дублирующий onSnapshot для programs удалён из App.tsx — programs читается через `useData()` из DataContext. `openProgramId` поднят в App.tsx как controlled prop (паттерн как у selectedRecipe в RecipesView). `onRecipeTargetSet` добавлен в ProgramsViewProps для сигнала из ProgramDetailModal в App.tsx при добавлении рецепта через photo/PDF/link/manual. App.tsx: 4538 → ~2000 строк (−~55%).
```

- [ ] **Step 2: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: update roadmap — Phase 1 Step 4 Programs complete"
```
