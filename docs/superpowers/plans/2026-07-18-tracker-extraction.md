# Tracker Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the Tracker tab from the App.tsx monolith into `src/features/tracker/` with two co-located modals, reducing App.tsx to under 300 lines.

**Architecture:** `TrackerView` receives only shared props (`checkedEntries`, `mealTypes`, navigation/selection callbacks) and pulls everything else from context hooks (`useData`, `useNutritionPlan`, `useUserProfile`). `AISuggestModal` and `ProgramSelectionModal` are standalone co-located components. All Tracker-specific state (`suggestion`, `isSuggesting`, `isProgramSelectionOpen`, `customPlanForm`) moves inside the feature.

**Tech Stack:** React 19, TypeScript strict, Vitest + @testing-library/react, Firebase Firestore (`addDoc`), `aiClient.fillRemaining`, `motion/react`, `lucide-react`, `clsx` + `tailwind-merge`, `date-fns`.

**Spec:** `docs/superpowers/specs/2026-07-18-tracker-extraction-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/features/tracker/TrackerView.tsx` | Main view + state orchestration for both modals |
| Create | `src/features/tracker/AISuggestModal.tsx` | AI suggestion modal (pure display + callbacks) |
| Create | `src/features/tracker/ProgramSelectionModal.tsx` | Program selection modal (own context calls) |
| Create | `src/features/tracker/__tests__/TrackerView.test.tsx` | Smoke + critical behaviour tests |
| Modify | `src/App.tsx` | Remove renderTracker + both modals + tracker state; add TrackerView |

---

## Task 1: Create AISuggestModal

**Files:**
- Create: `src/features/tracker/AISuggestModal.tsx`

- [ ] **Step 1.1: Create the file**

```tsx
// src/features/tracker/AISuggestModal.tsx
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Plus, Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FillRemainingOption } from '@/services/ai/contracts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type SuggestionResult = {
  options: FillRemainingOption[];
  reason: string;
};

export type AISuggestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  suggestion: SuggestionResult | null;
  isSuggesting: boolean;
  selectedIds: string[];
  onToggleId: (id: string) => void;
  onAddSelected: () => Promise<void>;
  onRequestAlternative: () => void;
};

export function AISuggestModal({
  isOpen,
  onClose,
  suggestion,
  isSuggesting,
  selectedIds,
  onToggleId,
  onAddSelected,
  onRequestAlternative,
}: AISuggestModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900">Рекомендация ИИ</h2>
              </div>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            {!suggestion ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
                <p className="text-zinc-500 font-medium">Анализирую ваши КБЖУ и рецепты...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                  <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-4">
                    Рекомендация на остаток кбжу на день
                  </h3>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {suggestion.options.map((option) => (
                      <div
                        key={option.id}
                        className={cn(
                          'bg-white p-4 rounded-xl border transition-all cursor-pointer relative group',
                          selectedIds.includes(option.id)
                            ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500'
                            : 'border-emerald-100 shadow-sm hover:border-emerald-300',
                        )}
                        onClick={() => onToggleId(option.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5',
                              selectedIds.includes(option.id)
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-zinc-200 bg-white',
                            )}
                          >
                            {selectedIds.includes(option.id) && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-zinc-900 text-sm leading-tight">
                                {option.type === 'recipe' ? `Рецепт: ${option.description}` : option.description}
                              </span>
                              <span className="text-xs font-bold text-emerald-600 ml-2 whitespace-nowrap">
                                {option.macros.calories} ккал
                              </span>
                            </div>
                            <div className="flex gap-3 text-[10px] font-bold text-zinc-400 uppercase">
                              <span>Б: {option.macros.proteins}г</span>
                              <span>Ж: {option.macros.fats}г</span>
                              <span>У: {option.macros.carbs}г</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-emerald-700 text-sm mt-6 italic">"{suggestion.reason}"</p>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    disabled={selectedIds.length === 0}
                    onClick={onAddSelected}
                    className={cn(
                      'w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg',
                      selectedIds.length > 0
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100'
                        : 'bg-zinc-100 text-zinc-400 cursor-not-allowed',
                    )}
                  >
                    <Plus className="w-5 h-5" />
                    Добавить в рацион ({selectedIds.length})
                  </button>
                  <button
                    onClick={onRequestAlternative}
                    disabled={isSuggesting}
                    className="w-full py-3 bg-zinc-100 text-zinc-600 rounded-xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                  >
                    {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Предложить другие варианты
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 1.2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors (or only errors unrelated to the new file).

- [ ] **Step 1.3: Commit**

```bash
git add src/features/tracker/AISuggestModal.tsx
git commit -m "feat(tracker): add AISuggestModal component"
```

---

## Task 2: Create ProgramSelectionModal

**Files:**
- Create: `src/features/tracker/ProgramSelectionModal.tsx`

- [ ] **Step 2.1: Create the file**

```tsx
// src/features/tracker/ProgramSelectionModal.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Check, Edit3 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import { useData } from '@/app/providers/DataContext';
import { useNutritionPlan } from '@/app/providers/UserProfileContext';
import { useUserProfile } from '@/app/providers/UserProfileContext';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CustomPlanForm = {
  name: string;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
};

export type ProgramSelectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ProgramSelectionModal({ isOpen, onClose }: ProgramSelectionModalProps) {
  const { programs } = useData();
  const { activeNutritionPlan, setActivePlan } = useNutritionPlan();
  const { userProfile } = useUserProfile();

  const [customPlanForm, setCustomPlanForm] = useState<CustomPlanForm>({
    name: '',
    calories: 0,
    proteins: 0,
    fats: 0,
    carbs: 0,
  });

  const handleApplyCustomPlan = async () => {
    if (!customPlanForm.name) return;

    const newProgram = {
      name: customPlanForm.name,
      description: 'Свой план питания',
      creator: userProfile?.name ?? 'Я',
      targetCalories: customPlanForm.calories,
      targetProteins: customPlanForm.proteins,
      targetFats: customPlanForm.fats,
      targetCarbs: customPlanForm.carbs,
      recipeIds: [],
      subfolders: [],
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'programs'), newProgram);

    await setActivePlan({
      ...customPlanForm,
      isCustom: true,
      programId: docRef.id,
      allowedProducts: [],
      forbiddenProducts: [],
    });

    setCustomPlanForm({ name: '', calories: 0, proteins: 0, fats: 0, carbs: 0 });
    onClose();
  };

  const handleSelectProgram = async (plan: ActiveNutritionPlan) => {
    await setActivePlan(plan);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-lg font-bold">Выбрать программу питания</h3>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              {/* Custom Plan Form */}
              <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 space-y-4">
                <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  Свой план питания
                </h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Название плана (напр. Сушка)"
                    value={customPlanForm.name}
                    onChange={(e) => setCustomPlanForm({ ...customPlanForm, name: e.target.value })}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Ккал"
                      value={customPlanForm.calories || ''}
                      onChange={(e) => setCustomPlanForm({ ...customPlanForm, calories: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Белки (г)"
                      value={customPlanForm.proteins || ''}
                      onChange={(e) => setCustomPlanForm({ ...customPlanForm, proteins: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Жиры (г)"
                      value={customPlanForm.fats || ''}
                      onChange={(e) => setCustomPlanForm({ ...customPlanForm, fats: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Углеводы (г)"
                      value={customPlanForm.carbs || ''}
                      onChange={(e) => setCustomPlanForm({ ...customPlanForm, carbs: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-emerald-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => void handleApplyCustomPlan()}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    Применить свой план
                  </button>
                </div>
              </div>

              {/* Existing Programs */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Доступные программы</h4>

                <button
                  onClick={() => { void setActivePlan(null); onClose(); }}
                  className={cn(
                    'w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group',
                    !activeNutritionPlan
                      ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                      : 'bg-white border-zinc-100 hover:border-emerald-200',
                  )}
                >
                  <div>
                    <h5 className="font-bold text-zinc-900">По умолчанию</h5>
                    <p className="text-xs text-zinc-500">Данные из ваших настроек профиля</p>
                  </div>
                  {!activeNutritionPlan && <Check className="w-5 h-5 text-emerald-600" />}
                </button>

                {programs.map((program) => (
                  <div key={program.id} className="space-y-2">
                    <button
                      onClick={() =>
                        void handleSelectProgram({
                          name: program.name,
                          calories: program.targetCalories ?? userProfile?.targetCalories ?? 0,
                          proteins: program.targetProteins ?? userProfile?.targetProteins ?? 0,
                          fats: program.targetFats ?? userProfile?.targetFats ?? 0,
                          carbs: program.targetCarbs ?? userProfile?.targetCarbs ?? 0,
                          isCustom: false,
                          programId: program.id,
                          allowedProducts: program.allowedProducts,
                          forbiddenProducts: program.forbiddenProducts,
                        })
                      }
                      className={cn(
                        'w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between group',
                        activeNutritionPlan?.programId === program.id && !activeNutritionPlan?.subfolderId
                          ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                          : 'bg-white border-zinc-100 hover:border-emerald-200',
                      )}
                    >
                      <div>
                        <h5 className="font-bold text-zinc-900">{program.name}</h5>
                        {program.targetCalories ? (
                          <p className="text-xs text-emerald-600 font-medium">
                            {program.targetCalories} ккал • Б:{program.targetProteins} Ж:{program.targetFats} У:{program.targetCarbs}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-400 italic">КБЖУ не заданы (будут взяты из настроек)</p>
                        )}
                      </div>
                      {activeNutritionPlan?.programId === program.id && !activeNutritionPlan?.subfolderId && (
                        <Check className="w-5 h-5 text-emerald-600" />
                      )}
                    </button>

                    {program.subfolders && program.subfolders.length > 0 && (
                      <div className="pl-6 space-y-2">
                        {program.subfolders.map((subfolder) => (
                          <button
                            key={subfolder.id}
                            onClick={() =>
                              void handleSelectProgram({
                                name: program.name,
                                subfolderName: subfolder.name,
                                calories:
                                  subfolder.targetCalories ??
                                  program.targetCalories ??
                                  userProfile?.targetCalories ?? 0,
                                proteins:
                                  subfolder.targetProteins ??
                                  program.targetProteins ??
                                  userProfile?.targetProteins ?? 0,
                                fats:
                                  subfolder.targetFats ??
                                  program.targetFats ??
                                  userProfile?.targetFats ?? 0,
                                carbs:
                                  subfolder.targetCarbs ??
                                  program.targetCarbs ??
                                  userProfile?.targetCarbs ?? 0,
                                isCustom: false,
                                programId: program.id,
                                subfolderId: subfolder.id,
                                allowedProducts: subfolder.allowedProducts ?? program.allowedProducts,
                                forbiddenProducts: subfolder.forbiddenProducts ?? program.forbiddenProducts,
                              })
                            }
                            className={cn(
                              'w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between group',
                              activeNutritionPlan?.subfolderId === subfolder.id
                                ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                                : 'bg-white border-zinc-50 hover:border-emerald-100',
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                              <div>
                                <h6 className="text-sm font-bold text-zinc-700">{subfolder.name}</h6>
                                {subfolder.targetCalories && (
                                  <p className="text-[10px] text-emerald-600 font-medium">
                                    {subfolder.targetCalories} ккал
                                  </p>
                                )}
                              </div>
                            </div>
                            {activeNutritionPlan?.subfolderId === subfolder.id && (
                              <Check className="w-4 h-4 text-emerald-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

> **Note on «По умолчанию» button:** The click handler above is verbose due to TypeScript — simplify it inline if the type allows `setActivePlan(null)` directly:
> ```tsx
> onClick={() => { void setActivePlan(null); onClose(); }}
> ```

- [ ] **Step 2.2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2.3: Commit**

```bash
git add src/features/tracker/ProgramSelectionModal.tsx
git commit -m "feat(tracker): add ProgramSelectionModal component"
```

---

## Task 3: Create TrackerView test (TDD — write first)

**Files:**
- Create: `src/features/tracker/__tests__/TrackerView.test.tsx`

- [ ] **Step 3.1: Create the test file**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DataContext } from '@/app/providers/DataContext';
import { UserProfileContext } from '@/app/providers/UserProfileContext';
import type { UserProfile, ActiveNutritionPlan, PlannerEntry, Recipe } from '@/shared/domain/types';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'test-id' }),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn(),
}));

vi.mock('@/infrastructure/firebaseApp', () => ({ db: {} }));

vi.mock('@/services/ai/aiClient', () => ({
  aiClient: {
    fillRemaining: vi.fn().mockResolvedValue({
      options: [
        {
          id: 'opt-1',
          type: 'product',
          description: 'Творог 5%',
          macros: { calories: 120, proteins: 18, fats: 5, carbs: 3 },
        },
      ],
      reason: 'Хороший источник белка',
    }),
  },
}));

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

const mockNutritionPlan: ActiveNutritionPlan | null = null;
const mockSetActivePlan = vi.fn().mockResolvedValue(undefined);
const mockSaveUserProfile = vi.fn().mockResolvedValue(undefined);

const today = new Date().toISOString().slice(0, 10);

const mockRecipe: Recipe = {
  id: 'r1',
  title: 'Куриная грудка',
  macros: { calories: 200, proteins: 30, fats: 5, carbs: 0 },
  ingredients: [],
  instructions: '',
  categories: [],
};

const mockEntry: PlannerEntry = {
  id: 'e1',
  date: today,
  mealType: 'Обед',
  type: 'recipe',
  recipeId: 'r1',
  createdAt: new Date().toISOString(),
};

const emptyData = { recipes: [], plannerEntries: [], cartItems: [], programs: [] };
const dataWithEntry = { recipes: [mockRecipe], plannerEntries: [mockEntry], cartItems: [], programs: [] };

function makeWrapper(data: typeof emptyData) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <UserProfileContext.Provider
        value={{
          userProfile: mockProfile,
          saveUserProfile: mockSaveUserProfile,
          activeNutritionPlan: mockNutritionPlan,
          setActivePlan: mockSetActivePlan,
        }}
      >
        <DataContext.Provider value={data}>
          {children}
        </DataContext.Provider>
      </UserProfileContext.Provider>
    );
  };
}

describe('TrackerView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', async () => {
    let mod: { TrackerView: React.ComponentType<any> } | null = null;
    try {
      mod = await import('../TrackerView');
    } catch {
      expect(true).toBe(false);
      return;
    }

    const { TrackerView } = mod;
    const Wrapper = makeWrapper(emptyData);

    render(
      <Wrapper>
        <TrackerView
          checkedEntries={[]}
          onCheckedEntriesChange={vi.fn()}
          mealTypes={['Завтрак', 'Обед', 'Ужин', 'Перекус']}
          onSelectRecipe={vi.fn()}
          onNavigateToPlanner={vi.fn()}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/трекер твоего питания сегодня/i)).toBeDefined();
  });

  it('shows meal from plannerEntries for today when entry is checked', async () => {
    let mod: { TrackerView: React.ComponentType<any> } | null = null;
    try {
      mod = await import('../TrackerView');
    } catch {
      expect(true).toBe(false);
      return;
    }

    const { TrackerView } = mod;
    const Wrapper = makeWrapper(dataWithEntry);

    render(
      <Wrapper>
        <TrackerView
          checkedEntries={['e1']}
          onCheckedEntriesChange={vi.fn()}
          mealTypes={['Завтрак', 'Обед', 'Ужин', 'Перекус']}
          onSelectRecipe={vi.fn()}
          onNavigateToPlanner={vi.fn()}
        />
      </Wrapper>,
    );

    expect(screen.getByText('Куриная грудка')).toBeDefined();
  });

  it('calls onNavigateToPlanner when empty state link is clicked', async () => {
    let mod: { TrackerView: React.ComponentType<any> } | null = null;
    try {
      mod = await import('../TrackerView');
    } catch {
      expect(true).toBe(false);
      return;
    }

    const { TrackerView } = mod;
    const Wrapper = makeWrapper(emptyData);
    const onNavigateToPlanner = vi.fn();

    render(
      <Wrapper>
        <TrackerView
          checkedEntries={[]}
          onCheckedEntriesChange={vi.fn()}
          mealTypes={['Завтрак', 'Обед', 'Ужин', 'Перекус']}
          onSelectRecipe={vi.fn()}
          onNavigateToPlanner={onNavigateToPlanner}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByText(/перейти в планер/i));
    expect(onNavigateToPlanner).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3.2: Run tests to confirm they fail (TrackerView not yet created)**

```bash
npx vitest run src/features/tracker/__tests__/TrackerView.test.tsx
```

Expected: all 3 tests FAIL with import error or "expect(true).toBe(false)".

- [ ] **Step 3.3: Commit the test file**

```bash
git add src/features/tracker/__tests__/TrackerView.test.tsx
git commit -m "test(tracker): add failing TrackerView tests (TDD)"
```

---

## Task 4: Create TrackerView

**Files:**
- Create: `src/features/tracker/TrackerView.tsx`

- [ ] **Step 4.1: Create the file**

```tsx
// src/features/tracker/TrackerView.tsx
import React, { useState } from 'react';
import {
  Target,
  Droplets,
  AlertCircle,
  Sparkles,
  Loader2,
  Check,
  ChevronRight,
  Calendar,
  Settings2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import { format } from 'date-fns';
import { useData } from '@/app/providers/DataContext';
import { useNutritionPlan } from '@/app/providers/UserProfileContext';
import { useUserProfile } from '@/app/providers/UserProfileContext';
import { aiClient } from '@/services/ai/aiClient';
import type { Recipe } from '@/shared/domain/types';
import { AISuggestModal, type SuggestionResult } from './AISuggestModal';
import { ProgramSelectionModal } from './ProgramSelectionModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type TrackerViewProps = {
  checkedEntries: string[];
  onCheckedEntriesChange: (entries: string[]) => void;
  mealTypes: string[];
  onSelectRecipe: (recipe: Recipe) => void;
  onNavigateToPlanner: () => void;
};

export function TrackerView({
  checkedEntries,
  onCheckedEntriesChange,
  mealTypes,
  onSelectRecipe,
  onNavigateToPlanner,
}: TrackerViewProps) {
  const { plannerEntries, recipes } = useData();
  const { activeNutritionPlan } = useNutritionPlan();
  const { userProfile } = useUserProfile();

  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [isProgramSelectionOpen, setIsProgramSelectionOpen] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayEntries = plannerEntries.filter((e) => e.date === today);
  const checkedEntriesData = todayEntries.filter((e) => checkedEntries.includes(e.id));

  const actualMacros = checkedEntriesData.reduce(
    (acc, entry) => {
      const macros =
        entry.type === 'recipe' ? recipes.find((r) => r.id === entry.recipeId)?.macros : entry.macros;
      if (macros) {
        acc.calories += macros.calories;
        acc.proteins += macros.proteins;
        acc.fats += macros.fats;
        acc.carbs += macros.carbs;
      }
      return acc;
    },
    { calories: 0, proteins: 0, fats: 0, carbs: 0 },
  );

  const currentTargets = activeNutritionPlan ?? {
    name: 'По умолчанию (из настроек)',
    calories: userProfile?.targetCalories ?? 0,
    proteins: userProfile?.targetProteins ?? 0,
    fats: userProfile?.targetFats ?? 0,
    carbs: userProfile?.targetCarbs ?? 0,
  };

  const remainingMacros = {
    calories: Math.max(0, currentTargets.calories - actualMacros.calories),
    proteins: Math.max(0, currentTargets.proteins - actualMacros.proteins),
    fats: Math.max(0, currentTargets.fats - actualMacros.fats),
    carbs: Math.max(0, currentTargets.carbs - actualMacros.carbs),
  };

  const handleSuggest = async (isAlternative = false) => {
    if (remainingMacros.calories < 50 && !isAlternative) {
      alert('У вас осталось слишком мало калорий для рекомендаций!');
      return;
    }

    setIsSuggesting(true);
    if (!isAlternative) {
      setSuggestion(null);
      setSelectedSuggestionIds([]);
    }

    try {
      const result = await aiClient.fillRemaining({
        remaining: remainingMacros,
        planName: currentTargets.name,
        allergies: userProfile?.allergies ?? [],
        activeProgramRules: {
          allowedProducts: activeNutritionPlan?.allowedProducts ?? [],
          forbiddenProducts: activeNutritionPlan?.forbiddenProducts ?? [],
        },
        userRecipes: recipes.map((r) => ({ id: r.id, title: r.title, macros: r.macros })),
      });

      if (isAlternative && suggestion) {
        setSuggestion({ ...result, options: [...suggestion.options, ...result.options] });
      } else {
        setSuggestion(result);
      }
    } catch (error) {
      console.error('Error getting suggestion:', error);
      alert('Не удалось получить рекомендацию');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAddSelectedSuggestions = async () => {
    if (!suggestion || selectedSuggestionIds.length === 0) return;

    const selectedOptions = suggestion.options.filter((opt) => selectedSuggestionIds.includes(opt.id));

    try {
      for (const option of selectedOptions) {
        await addDoc(collection(db, 'planner'), {
          date: today,
          mealType: 'Перекус',
          type: option.type,
          recipeId: option.type === 'recipe' ? (option.recipeId ?? null) : null,
          productName: option.type === 'product' ? option.description : null,
          macros: option.macros,
          createdAt: new Date().toISOString(),
        });
      }
      setSuggestion(null);
      setSelectedSuggestionIds([]);
      setIsSuggesting(false);
      alert('Выбранные варианты добавлены в ваш рацион на сегодня!');
    } catch (error) {
      console.error('Error adding suggestions:', error);
      alert('Не удалось добавить варианты в рацион');
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-zinc-900">Трекер твоего питания сегодня</h2>
          <p className="text-zinc-500 text-sm">Следи за прогрессом и достигай своих целей</p>
        </div>

        {/* Water Reminder */}
        <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              <Droplets className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900">Не забудь пить достаточно воды сегодня!</h3>
              <p className="text-blue-700 text-sm">Твоя цель: {userProfile?.waterGoal} мл</p>
            </div>
          </div>
          <div className="text-blue-600 font-bold text-xl">
            {Math.round((userProfile?.currentWeight ?? 0) * 35)} мл/день
          </div>
        </div>

        {/* Active Plan Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase">Текущий план</p>
              <h3 className="text-sm font-bold text-zinc-900">
                {currentTargets.name}
                {activeNutritionPlan?.subfolderName && (
                  <span className="text-emerald-600 ml-1">/ {activeNutritionPlan.subfolderName}</span>
                )}
              </h3>
            </div>
          </div>
          <button
            onClick={() => setIsProgramSelectionOpen(true)}
            className="flex items-center gap-2 bg-white border border-zinc-200 px-4 py-2 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all shadow-sm"
          >
            <Settings2 className="w-4 h-4" />
            Выбрать программу
          </button>
        </div>

        {/* Macros Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(
            [
              { label: 'Калории', key: 'calories' as const, unit: 'ккал', okColor: 'bg-emerald-500' },
              { label: 'Белки',   key: 'proteins' as const, unit: 'г',    okColor: 'bg-blue-500'    },
              { label: 'Жиры',    key: 'fats'     as const, unit: 'г',    okColor: 'bg-orange-500'  },
              { label: 'Углеводы',key: 'carbs'    as const, unit: 'г',    okColor: 'bg-purple-500'  },
            ] as const
          ).map(({ label, key, unit, okColor }) => {
            const actual = actualMacros[key];
            const target = currentTargets[key];
            const exceeded = actual > target;
            return (
              <div
                key={key}
                className={cn(
                  'bg-white p-6 rounded-3xl border shadow-sm transition-all duration-300',
                  exceeded ? 'border-red-500 shadow-red-50' : 'border-zinc-100',
                )}
              >
                <p className="text-xs font-bold text-zinc-400 uppercase mb-1">{label}</p>
                <div className="flex items-end gap-2">
                  <span className={cn('text-2xl font-bold', exceeded ? 'text-red-600' : 'text-zinc-900')}>
                    {actual}{key !== 'calories' ? 'г' : ''}
                  </span>
                  <span className="text-zinc-400 text-sm mb-1">
                    / {target} {unit}
                  </span>
                </div>
                {exceeded && (
                  <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> вы превысили норму
                  </p>
                )}
                <div className="mt-4 h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-500',
                      exceeded ? 'bg-red-500' : okColor,
                    )}
                    style={{ width: `${Math.min(100, (actual / (target || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Today's Meals */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-zinc-900">Твой план на сегодня</h3>
          {todayEntries.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-100 p-12 text-center">
              <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-zinc-200" />
              </div>
              <p className="text-zinc-500 text-sm">На сегодня ничего не запланировано</p>
              <button
                onClick={onNavigateToPlanner}
                className="mt-4 text-emerald-600 font-bold hover:text-emerald-700"
              >
                Перейти в планер
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {mealTypes.map((meal) => {
                const mealEntries = todayEntries.filter((e) => e.mealType === meal);
                if (mealEntries.length === 0) return null;
                return (
                  <div key={meal} className="bg-white rounded-3xl border border-zinc-100 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 bg-zinc-50/50 border-b border-zinc-100 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{meal}</h4>
                    </div>
                    <div className="divide-y divide-zinc-50">
                      {mealEntries.map((entry) => {
                        const isChecked = checkedEntries.includes(entry.id);
                        const recipe = entry.type === 'recipe' ? recipes.find((r) => r.id === entry.recipeId) : null;
                        const title = entry.type === 'recipe' ? recipe?.title : entry.productName;
                        const calories =
                          entry.type === 'recipe' ? recipe?.macros.calories : entry.macros?.calories;
                        return (
                          <div key={entry.id} className="p-4 flex items-center gap-4 group">
                            <button
                              onClick={() => {
                                if (isChecked) {
                                  onCheckedEntriesChange(checkedEntries.filter((id) => id !== entry.id));
                                } else {
                                  onCheckedEntriesChange([...checkedEntries, entry.id]);
                                }
                              }}
                              className={cn(
                                'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all',
                                isChecked
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-zinc-200 text-transparent',
                              )}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <div className="flex-1">
                              <p className={cn('font-bold text-zinc-900', isChecked && 'line-through opacity-50')}>
                                {title}
                              </p>
                              <p className="text-xs text-zinc-400">{calories} ккал</p>
                            </div>
                            {entry.type === 'recipe' && recipe && (
                              <button
                                onClick={() => onSelectRecipe(recipe)}
                                className="p-2 text-zinc-300 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Suggestion Section */}
        <div className="pt-8 border-t border-zinc-100">
          <div className="flex flex-col items-start gap-4">
            <button
              onClick={() => void handleSuggest(false)}
              disabled={isSuggesting}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSuggesting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Подбираем варианты...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Заполнить остаток кбжу</span>
                </>
              )}
            </button>
            <p className="text-zinc-500 text-sm max-w-md">
              Ты не знаешь что съесть на остаток твоих кбжу сегодня? Нажми на кнопку и получи варианты на выбор
            </p>
          </div>

          <AnimatePresence>
            {suggestion && !isSuggesting && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="mt-8 space-y-6"
              >
                <div className="bg-emerald-50 rounded-3xl p-6 border border-emerald-100">
                  <h4 className="font-bold text-emerald-900 mb-1 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Рекомендации для тебя
                  </h4>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-3">
                    Подобрано согласно вашему плану: {activeNutritionPlan?.name ?? 'По умолчанию'}
                  </p>
                  <p className="text-emerald-700 text-sm mb-6">{suggestion.reason}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {suggestion.options.map((option) => (
                      <div
                        key={option.id}
                        className={cn(
                          'bg-white p-4 rounded-2xl border transition-all cursor-pointer',
                          selectedSuggestionIds.includes(option.id)
                            ? 'border-emerald-500 shadow-md'
                            : 'border-zinc-100 hover:border-emerald-200',
                        )}
                        onClick={() => {
                          if (selectedSuggestionIds.includes(option.id)) {
                            setSelectedSuggestionIds(selectedSuggestionIds.filter((id) => id !== option.id));
                          } else {
                            setSelectedSuggestionIds([...selectedSuggestionIds, option.id]);
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center transition-all mt-1',
                              selectedSuggestionIds.includes(option.id)
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-zinc-200 text-transparent',
                            )}
                          >
                            <Check className="w-3 h-3" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-zinc-900 text-sm mb-2">{option.description}</p>
                            <div className="flex gap-3 text-[10px] font-bold text-zinc-400 uppercase">
                              <span className="text-emerald-600">{option.macros.calories} ккал</span>
                              <span>Б: {option.macros.proteins}г</span>
                              <span>Ж: {option.macros.fats}г</span>
                              <span>У: {option.macros.carbs}г</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 mt-6">
                    {selectedSuggestionIds.length > 0 && (
                      <button
                        onClick={() => void handleAddSelectedSuggestions()}
                        className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                      >
                        Добавить в рацион
                      </button>
                    )}
                    <button
                      onClick={() => void handleSuggest(true)}
                      disabled={isSuggesting}
                      className="flex-1 py-4 bg-white border border-emerald-200 text-emerald-600 rounded-2xl font-bold hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                    >
                      {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Предложить альтернативу
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AISuggestModal
        isOpen={isSuggesting}
        onClose={() => {
          setIsSuggesting(false);
          setSuggestion(null);
        }}
        suggestion={suggestion}
        isSuggesting={isSuggesting}
        selectedIds={selectedSuggestionIds}
        onToggleId={(id) =>
          setSelectedSuggestionIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
          )
        }
        onAddSelected={handleAddSelectedSuggestions}
        onRequestAlternative={() => void handleSuggest(true)}
      />

      <ProgramSelectionModal
        isOpen={isProgramSelectionOpen}
        onClose={() => setIsProgramSelectionOpen(false)}
      />
    </>
  );
}
```

- [ ] **Step 4.2: Run the tests — they should now pass**

```bash
npx vitest run src/features/tracker/__tests__/TrackerView.test.tsx
```

Expected: all 3 tests PASS.

- [ ] **Step 4.3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4.4: Commit**

```bash
git add src/features/tracker/TrackerView.tsx
git commit -m "feat(tracker): add TrackerView component"
```

---

## Task 5: Wire TrackerView into App.tsx and remove old code

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 5.1: Add TrackerView import to App.tsx**

Add alongside other feature imports (near `PlannerView`, `RecipesView`, etc.):

```tsx
import { TrackerView } from '@/features/tracker/TrackerView';
```

- [ ] **Step 5.2: Replace `case 'tracker'` in `renderContent()`**

Find (around line 856):
```tsx
      case 'tracker':
        return renderTracker();
```

Replace with:
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

- [ ] **Step 5.3: Delete `renderTracker()` function from App.tsx**

Remove the entire block from line 450 to line 807:

```
const renderTracker = () => {
  ...
};
```

- [ ] **Step 5.4: Delete AI Suggest Modal JSX from App.tsx return**

Remove the entire `<AnimatePresence>` block (lines ~892–1021) that starts with:
```tsx
{isSuggesting && (
  <div className="fixed inset-0 z-[200] ...
```

- [ ] **Step 5.5: Delete ProgramSelection Modal JSX from App.tsx return**

Remove the entire `<AnimatePresence>` block (lines ~1162–1395) that starts with:
```tsx
{isProgramSelectionOpen && (
  <div className="fixed inset-0 z-[160] ...
```

- [ ] **Step 5.6: Delete tracker-specific state declarations from App.tsx**

Remove these lines:

```tsx
const [suggestion, setSuggestion] = useState<{
  options: { 
    id: string;
    type: 'recipe' | 'product';
    recipeId?: string;
    description: string; 
    macros: { calories: number; proteins: number; fats: number; carbs: number; } 
  }[];
  reason: string;
} | null>(null);
const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
```

```tsx
const [isSuggesting, setIsSuggesting] = useState(false);
```

```tsx
const [isProgramSelectionOpen, setIsProgramSelectionOpen] = useState(false);
const [customPlanForm, setCustomPlanForm] = useState({
  name: '', calories: 0, proteins: 0, fats: 0, carbs: 0
});
```

- [ ] **Step 5.7: Delete `handleSuggest` and `handleAddSelectedSuggestions` from App.tsx**

Remove both function bodies (lines ~156–260).

- [ ] **Step 5.8: Clean up any now-unused imports in App.tsx**

After the deletions, check the import list at the top of App.tsx. Remove imports that are no longer used, for example:
- `Edit3` (only used in ProgramSelectionModal)
- `Settings2` (only used in TrackerView)
- `Droplets`, `Target` (only used in TrackerView)
- Any other icon or utility only referenced in removed code

Run:
```bash
npx tsc --noEmit
```

TypeScript will report unused variables if any remain. Fix until 0 errors.

- [ ] **Step 5.9: Verify full build passes**

```bash
npm run build
```

Expected: successful build, 0 errors.

- [ ] **Step 5.10: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 5.11: Check App.tsx line count**

```bash
wc -l src/App.tsx
```

Expected: well under 500 lines (target < 300 before Step 5 final cleanup).

- [ ] **Step 5.12: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(tracker): extract TrackerView — remove renderTracker and modals from App.tsx"
```

---

## Done Criteria

- [ ] `npm run build` — green, 0 errors
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx vitest run` — all tests pass
- [ ] `wc -l src/App.tsx` — under 300 lines
- [ ] Tracker tab works in browser: meals display, checkbox toggles, AI suggest opens, program selection opens
- [ ] `checkedEntries` sync between Planner and Tracker preserved (check both tabs in browser)
