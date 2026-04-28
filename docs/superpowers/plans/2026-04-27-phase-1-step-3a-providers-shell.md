# Phase 1 Step 3a — Providers & Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create React Context providers for repository injection, reactive data, and user profile; extract TabBar and Shell layout components; migrate `activeNutritionPlan` from localStorage to Firestore; wire everything into `main.tsx`.

**Architecture:** Three contexts form a stack — `RepositoryContext` holds repo instances, `DataContext` exposes live arrays by subscribing to repos, `UserProfileContext` exposes profile + active nutrition plan. `Shell` is the root layout div; `TabBar` is extracted from App.tsx's inline nav. App.tsx is minimally touched: only `activeNutritionPlan` state and the inline nav are migrated; all other state stays in App.tsx until Step 4 (per-tab splits).

**Tech Stack:** React 19 Context API, Vitest 4 + @testing-library/react (jsdom), TypeScript strict, existing Fake repo implementations in `src/infrastructure/testing/`.

---

## File Map

**Create:**
- `src/app/providers/RepositoryContext.ts` — `Repositories` type + `RepositoryContext` + `useRepositories()` hook
- `src/app/providers/RepositoryProvider.tsx` — creates Firestore repo instances, provides via `RepositoryContext`
- `src/app/providers/DataContext.ts` — `DataState` type + `DataContext` + `useData()` hook
- `src/app/providers/DataProvider.tsx` — subscribes to Recipes/Planner/Cart/Programs repos; provides reactive arrays
- `src/app/providers/UserProfileContext.ts` — `UserProfileState` type + `UserProfileContext` + `useUserProfile()` + `useNutritionPlan()` hooks
- `src/app/providers/UserProfileProvider.tsx` — subscribes to UserProfile repo; loads/persists activeNutritionPlan via NutritionPlan repo
- `src/app/providers/__tests__/DataProvider.test.tsx` — contract tests with fakes
- `src/app/providers/__tests__/UserProfileProvider.test.tsx` — contract tests with fakes
- `src/app/layout/Shell.tsx` — root layout wrapper (`min-h-screen bg-zinc-50`)
- `src/app/layout/TabBar.tsx` — bottom navigation bar (extracted from App.tsx)
- `src/infrastructure/firestore/FirestoreNutritionPlanRepository.ts` — reads/writes Firestore `settings/plan` doc

**Modify:**
- `src/main.tsx` — wrap App in Shell + providers
- `src/App.tsx` — use `useNutritionPlan()` context (remove `activeNutritionPlan` useState + localStorage); replace inline `<nav>` + `NavItem` with `<TabBar>`
- `vitest.config.ts` — add coverage includes for new files

---

### Task 1: Install @testing-library/react and FirestoreNutritionPlanRepository

**Files:**
- Create: `src/infrastructure/firestore/FirestoreNutritionPlanRepository.ts`

- [ ] **Step 1: Install @testing-library/react**

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

Expected: packages added to `devDependencies` in `package.json`.

- [ ] **Step 2: Verify Vitest can see @testing-library/react**

```bash
node -e "require('@testing-library/react'); console.log('ok')"
```

Expected: prints `ok`.

- [ ] **Step 3: Write the failing test for FirestoreNutritionPlanRepository**

Create `src/infrastructure/firestore/__tests__/FirestoreNutritionPlanRepository.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';

// FirestoreNutritionPlanRepository can't be unit-tested without the Firebase emulator,
// so this file tests the contract via the fake to confirm the interface is consistent.
describe('NutritionPlanRepository contract', () => {
  let repo: FakeNutritionPlanRepository;

  beforeEach(() => {
    repo = new FakeNutritionPlanRepository();
  });

  it('returns null when nothing stored', async () => {
    expect(await repo.get()).toBeNull();
  });

  it('persists and retrieves a plan', async () => {
    const plan = {
      name: 'Test', calories: 1800, proteins: 100, fats: 60, carbs: 200,
      isCustom: false, allowedProducts: [], forbiddenProducts: [],
    };
    await repo.set(plan);
    expect(await repo.get()).toEqual(plan);
  });

  it('clears plan when set(null) is called', async () => {
    await repo.set({
      name: 'Test', calories: 1800, proteins: 100, fats: 60, carbs: 200,
      isCustom: false, allowedProducts: [], forbiddenProducts: [],
    });
    await repo.set(null);
    expect(await repo.get()).toBeNull();
  });
});
```

- [ ] **Step 4: Run test to confirm it passes (contract via fake)**

```bash
npx vitest run src/infrastructure/firestore/__tests__/FirestoreNutritionPlanRepository.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Implement FirestoreNutritionPlanRepository**

Create `src/infrastructure/firestore/FirestoreNutritionPlanRepository.ts`:

```typescript
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { NutritionPlanRepository } from '@/services/NutritionPlanRepository';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

const planRef = () => doc(db, 'settings', 'plan');

export class FirestoreNutritionPlanRepository implements NutritionPlanRepository {
  async get(): Promise<ActiveNutritionPlan | null> {
    const snap = await getDoc(planRef());
    return snap.exists() ? (snap.data() as ActiveNutritionPlan) : null;
  }

  async set(plan: ActiveNutritionPlan | null): Promise<void> {
    if (plan === null) {
      await deleteDoc(planRef());
    } else {
      await setDoc(planRef(), plan);
    }
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/firestore/FirestoreNutritionPlanRepository.ts \
        src/infrastructure/firestore/__tests__/FirestoreNutritionPlanRepository.test.ts \
        package.json package-lock.json
git commit -m "feat(infra): add FirestoreNutritionPlanRepository + install @testing-library/react"
```

---

### Task 2: RepositoryContext + RepositoryProvider

**Files:**
- Create: `src/app/providers/RepositoryContext.ts`
- Create: `src/app/providers/RepositoryProvider.tsx`

- [ ] **Step 1: Create RepositoryContext.ts**

```typescript
// src/app/providers/RepositoryContext.ts
import { createContext, useContext } from 'react';
import type { RecipesRepository } from '@/services/RecipesRepository';
import type { PlannerRepository } from '@/services/PlannerRepository';
import type { CartRepository } from '@/services/CartRepository';
import type { ProgramsRepository } from '@/services/ProgramsRepository';
import type { UserProfileRepository } from '@/services/UserProfileRepository';
import type { NutritionPlanRepository } from '@/services/NutritionPlanRepository';

export type Repositories = {
  recipes: RecipesRepository;
  planner: PlannerRepository;
  cart: CartRepository;
  programs: ProgramsRepository;
  userProfile: UserProfileRepository;
  nutritionPlan: NutritionPlanRepository;
};

export const RepositoryContext = createContext<Repositories | null>(null);

export function useRepositories(): Repositories {
  const ctx = useContext(RepositoryContext);
  if (ctx === null) throw new Error('useRepositories must be used within RepositoryProvider');
  return ctx;
}
```

- [ ] **Step 2: Create RepositoryProvider.tsx**

```tsx
// src/app/providers/RepositoryProvider.tsx
import { useMemo, type ReactNode } from 'react';
import { FirestoreRecipesRepository } from '@/infrastructure/firestore/FirestoreRecipesRepository';
import { FirestorePlannerRepository } from '@/infrastructure/firestore/FirestorePlannerRepository';
import { FirestoreCartRepository } from '@/infrastructure/firestore/FirestoreCartRepository';
import { FirestoreProgramsRepository } from '@/infrastructure/firestore/FirestoreProgramsRepository';
import { FirestoreUserProfileRepository } from '@/infrastructure/firestore/FirestoreUserProfileRepository';
import { FirestoreNutritionPlanRepository } from '@/infrastructure/firestore/FirestoreNutritionPlanRepository';
import { RepositoryContext, type Repositories } from './RepositoryContext';

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const repositories = useMemo<Repositories>(() => ({
    recipes: new FirestoreRecipesRepository(),
    planner: new FirestorePlannerRepository(),
    cart: new FirestoreCartRepository(),
    programs: new FirestoreProgramsRepository(),
    userProfile: new FirestoreUserProfileRepository(),
    nutritionPlan: new FirestoreNutritionPlanRepository(),
  }), []);

  return (
    <RepositoryContext.Provider value={repositories}>
      {children}
    </RepositoryContext.Provider>
  );
}
```

Note: The Firestore repo classes import `db` directly from `@/infrastructure/firebaseApp` — no constructor argument is needed. Confirm this matches what each class does (e.g. `FirestoreRecipesRepository` at `src/infrastructure/firestore/FirestoreRecipesRepository.ts`).

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/providers/RepositoryContext.ts src/app/providers/RepositoryProvider.tsx
git commit -m "feat(providers): add RepositoryContext and RepositoryProvider"
```

---

### Task 3: DataContext + DataProvider + tests

**Files:**
- Create: `src/app/providers/DataContext.ts`
- Create: `src/app/providers/DataProvider.tsx`
- Create: `src/app/providers/__tests__/DataProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/providers/__tests__/DataProvider.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DataProvider } from '../DataProvider';
import { useData } from '../DataContext';
import { RepositoryContext, type Repositories } from '../RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';

function makeRepos(): Repositories & {
  recipes: FakeRecipesRepository;
  cart: FakeCartRepository;
} {
  return {
    recipes: new FakeRecipesRepository(),
    planner: new FakePlannerRepository(),
    cart: new FakeCartRepository(),
    programs: new FakeProgramsRepository(),
    userProfile: new FakeUserProfileRepository(),
    nutritionPlan: new FakeNutritionPlanRepository(),
  };
}

function makeWrapper(repos: Repositories) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RepositoryContext.Provider value={repos}>
        <DataProvider>{children}</DataProvider>
      </RepositoryContext.Provider>
    );
  };
}

describe('DataProvider', () => {
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
  });

  it('starts with empty arrays', () => {
    const { result } = renderHook(() => useData(), { wrapper: makeWrapper(repos) });
    expect(result.current.recipes).toEqual([]);
    expect(result.current.plannerEntries).toEqual([]);
    expect(result.current.cartItems).toEqual([]);
    expect(result.current.programs).toEqual([]);
  });

  it('reflects recipes added to the repository', async () => {
    const { result } = renderHook(() => useData(), { wrapper: makeWrapper(repos) });

    await act(async () => {
      await repos.recipes.add({
        title: 'Borsch', time: '60m', servings: 4, categories: [],
        ingredients: [], steps: [], macros: { calories: 300, proteins: 10, fats: 5, carbs: 40 },
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    expect(result.current.recipes).toHaveLength(1);
    expect(result.current.recipes[0]?.title).toBe('Borsch');
  });

  it('reflects cart items added to the repository', async () => {
    const { result } = renderHook(() => useData(), { wrapper: makeWrapper(repos) });

    await act(async () => {
      await repos.cart.add({
        name: 'Milk', amount: '1L', sourceDishes: [], checked: false, createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartItems[0]?.name).toBe('Milk');
  });

  it('unsubscribes from all repos on unmount', () => {
    const { unmount } = renderHook(() => useData(), { wrapper: makeWrapper(repos) });
    unmount();
    // After unmount, adding to repo must NOT update (no crash = listeners cleaned up)
    expect(() => repos.recipes.add({
      title: 'test', time: '10m', servings: 1, categories: [],
      ingredients: [], steps: [], macros: { calories: 0, proteins: 0, fats: 0, carbs: 0 },
      createdAt: '2026-01-01T00:00:00.000Z',
    })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/providers/__tests__/DataProvider.test.tsx
```

Expected: FAIL — `DataProvider` not found.

- [ ] **Step 3: Create DataContext.ts**

```typescript
// src/app/providers/DataContext.ts
import { createContext, useContext } from 'react';
import type { Recipe, PlannerEntry, CartItem, Program } from '@/shared/domain/types';

export type DataState = {
  recipes: Recipe[];
  plannerEntries: PlannerEntry[];
  cartItems: CartItem[];
  programs: Program[];
};

export const DataContext = createContext<DataState>({
  recipes: [],
  plannerEntries: [],
  cartItems: [],
  programs: [],
});

export function useData(): DataState {
  return useContext(DataContext);
}
```

- [ ] **Step 4: Create DataProvider.tsx**

```tsx
// src/app/providers/DataProvider.tsx
import { useState, useEffect, type ReactNode } from 'react';
import type { Recipe, PlannerEntry, CartItem, Program } from '@/shared/domain/types';
import { DataContext } from './DataContext';
import { useRepositories } from './RepositoryContext';

export function DataProvider({ children }: { children: ReactNode }) {
  const { recipes: recipesRepo, planner: plannerRepo, cart: cartRepo, programs: programsRepo } = useRepositories();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plannerEntries, setPlannerEntries] = useState<PlannerEntry[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    const unsub = recipesRepo.subscribeAll(setRecipes);
    return unsub;
  }, [recipesRepo]);

  useEffect(() => {
    const unsub = plannerRepo.subscribeAll(setPlannerEntries);
    return unsub;
  }, [plannerRepo]);

  useEffect(() => {
    const unsub = cartRepo.subscribeAll(setCartItems);
    return unsub;
  }, [cartRepo]);

  useEffect(() => {
    const unsub = programsRepo.subscribeAll(setPrograms);
    return unsub;
  }, [programsRepo]);

  return (
    <DataContext.Provider value={{ recipes, plannerEntries, cartItems, programs }}>
      {children}
    </DataContext.Provider>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/app/providers/__tests__/DataProvider.test.tsx
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/app/providers/DataContext.ts src/app/providers/DataProvider.tsx \
        src/app/providers/__tests__/DataProvider.test.tsx
git commit -m "feat(providers): add DataContext and DataProvider with tests"
```

---

### Task 4: UserProfileContext + UserProfileProvider + tests

**Files:**
- Create: `src/app/providers/UserProfileContext.ts`
- Create: `src/app/providers/UserProfileProvider.tsx`
- Create: `src/app/providers/__tests__/UserProfileProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/providers/__tests__/UserProfileProvider.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { UserProfileProvider } from '../UserProfileProvider';
import { useUserProfile, useNutritionPlan } from '../UserProfileContext';
import { RepositoryContext, type Repositories } from '../RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';

const DEFAULT_PROFILE = {
  name: '',
  age: 30,
  gender: 'female' as const,
  currentWeight: 65,
  targetWeight: 60,
  targetCalories: 1800,
  targetProteins: 100,
  targetFats: 60,
  targetCarbs: 200,
  waterGoal: 2000,
  allergies: [],
};

function makeRepos(): Repositories & {
  userProfile: FakeUserProfileRepository;
  nutritionPlan: FakeNutritionPlanRepository;
} {
  return {
    recipes: new FakeRecipesRepository(),
    planner: new FakePlannerRepository(),
    cart: new FakeCartRepository(),
    programs: new FakeProgramsRepository(),
    userProfile: new FakeUserProfileRepository(),
    nutritionPlan: new FakeNutritionPlanRepository(),
  };
}

function makeWrapper(repos: Repositories) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RepositoryContext.Provider value={repos}>
        <UserProfileProvider>{children}</UserProfileProvider>
      </RepositoryContext.Provider>
    );
  };
}

describe('useUserProfile', () => {
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
  });

  it('starts with null profile', () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper: makeWrapper(repos) });
    expect(result.current.userProfile).toBeNull();
  });

  it('reflects profile saved to the repository', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper: makeWrapper(repos) });

    await act(async () => {
      await repos.userProfile.save({ ...DEFAULT_PROFILE, name: 'Anna' });
    });

    expect(result.current.userProfile?.name).toBe('Anna');
  });

  it('saveUserProfile writes to the repository', async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper: makeWrapper(repos) });

    await act(async () => {
      await result.current.saveUserProfile({ ...DEFAULT_PROFILE, name: 'Lena' });
    });

    expect(result.current.userProfile?.name).toBe('Lena');
  });
});

describe('useNutritionPlan', () => {
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
  });

  it('starts with null active plan', async () => {
    const { result } = renderHook(() => useNutritionPlan(), { wrapper: makeWrapper(repos) });
    // wait for async load
    await act(async () => {});
    expect(result.current.activeNutritionPlan).toBeNull();
  });

  it('loads a pre-existing plan from repository on mount', async () => {
    const plan = {
      name: 'Diet', calories: 1500, proteins: 90, fats: 50, carbs: 160,
      isCustom: false, allowedProducts: [], forbiddenProducts: [],
    };
    await repos.nutritionPlan.set(plan);

    const { result } = renderHook(() => useNutritionPlan(), { wrapper: makeWrapper(repos) });
    await act(async () => {});

    expect(result.current.activeNutritionPlan).toEqual(plan);
  });

  it('setActivePlan updates state and persists to repository', async () => {
    const { result } = renderHook(() => useNutritionPlan(), { wrapper: makeWrapper(repos) });
    await act(async () => {});

    const plan = {
      name: 'Keto', calories: 1600, proteins: 120, fats: 100, carbs: 30,
      isCustom: true, allowedProducts: [], forbiddenProducts: [],
    };

    await act(async () => {
      await result.current.setActivePlan(plan);
    });

    expect(result.current.activeNutritionPlan).toEqual(plan);
    expect(await repos.nutritionPlan.get()).toEqual(plan);
  });

  it('setActivePlan(null) clears the plan', async () => {
    const plan = {
      name: 'Diet', calories: 1500, proteins: 90, fats: 50, carbs: 160,
      isCustom: false, allowedProducts: [], forbiddenProducts: [],
    };
    await repos.nutritionPlan.set(plan);
    const { result } = renderHook(() => useNutritionPlan(), { wrapper: makeWrapper(repos) });
    await act(async () => {});

    await act(async () => {
      await result.current.setActivePlan(null);
    });

    expect(result.current.activeNutritionPlan).toBeNull();
    expect(await repos.nutritionPlan.get()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/providers/__tests__/UserProfileProvider.test.tsx
```

Expected: FAIL — `UserProfileProvider` not found.

- [ ] **Step 3: Create UserProfileContext.ts**

```typescript
// src/app/providers/UserProfileContext.ts
import { createContext, useContext } from 'react';
import type { UserProfile, ActiveNutritionPlan } from '@/shared/domain/types';

export type UserProfileState = {
  userProfile: UserProfile | null;
  saveUserProfile: (profile: UserProfile) => Promise<void>;
};

export type NutritionPlanState = {
  activeNutritionPlan: ActiveNutritionPlan | null;
  setActivePlan: (plan: ActiveNutritionPlan | null) => Promise<void>;
};

export const UserProfileContext = createContext<(UserProfileState & NutritionPlanState) | null>(null);

export function useUserProfile(): UserProfileState {
  const ctx = useContext(UserProfileContext);
  if (ctx === null) throw new Error('useUserProfile must be used within UserProfileProvider');
  return { userProfile: ctx.userProfile, saveUserProfile: ctx.saveUserProfile };
}

export function useNutritionPlan(): NutritionPlanState {
  const ctx = useContext(UserProfileContext);
  if (ctx === null) throw new Error('useNutritionPlan must be used within UserProfileProvider');
  return { activeNutritionPlan: ctx.activeNutritionPlan, setActivePlan: ctx.setActivePlan };
}
```

- [ ] **Step 4: Create UserProfileProvider.tsx**

```tsx
// src/app/providers/UserProfileProvider.tsx
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserProfile, ActiveNutritionPlan } from '@/shared/domain/types';
import { UserProfileContext } from './UserProfileContext';
import { useRepositories } from './RepositoryContext';

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { userProfile: userProfileRepo, nutritionPlan: nutritionPlanRepo } = useRepositories();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeNutritionPlan, setActiveNutritionPlan] = useState<ActiveNutritionPlan | null>(null);

  useEffect(() => {
    return userProfileRepo.subscribe(setUserProfile);
  }, [userProfileRepo]);

  useEffect(() => {
    nutritionPlanRepo.get().then(setActiveNutritionPlan);
  }, [nutritionPlanRepo]);

  const saveUserProfile = useCallback(async (profile: UserProfile) => {
    await userProfileRepo.save(profile);
  }, [userProfileRepo]);

  const setActivePlan = useCallback(async (plan: ActiveNutritionPlan | null) => {
    await nutritionPlanRepo.set(plan);
    setActiveNutritionPlan(plan);
  }, [nutritionPlanRepo]);

  return (
    <UserProfileContext.Provider value={{ userProfile, saveUserProfile, activeNutritionPlan, setActivePlan }}>
      {children}
    </UserProfileContext.Provider>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/app/providers/__tests__/UserProfileProvider.test.tsx
```

Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add src/app/providers/UserProfileContext.ts src/app/providers/UserProfileProvider.tsx \
        src/app/providers/__tests__/UserProfileProvider.test.tsx
git commit -m "feat(providers): add UserProfileContext and UserProfileProvider with tests"
```

---

### Task 5: Shell and TabBar components

**Files:**
- Create: `src/app/layout/Shell.tsx`
- Create: `src/app/layout/TabBar.tsx`

- [ ] **Step 1: Create Shell.tsx**

```tsx
// src/app/layout/Shell.tsx
import type { ReactNode } from 'react';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create TabBar.tsx**

This component is extracted verbatim from `App.tsx` lines 6412–6446 and the `NavItem` helper at lines 7273–7293. The icons (BookOpen, Calendar, ShoppingCart, Activity, Users) are imported from `lucide-react`.

```tsx
// src/app/layout/TabBar.tsx
import { BookOpen, Calendar, ShoppingCart, Activity, Users } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Tab } from '@/shared/domain/types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TabBarProps = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

type NavItemProps = {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
};

function NavItem({ active, onClick, icon, label }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all duration-200 min-w-[64px]',
        active ? 'text-emerald-600' : 'text-zinc-400 hover:text-zinc-600'
      )}
    >
      <div className={cn('p-1 rounded-lg transition-colors', active ? 'bg-emerald-50' : 'bg-transparent')}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-zinc-200 px-4 py-3 z-50">
      <div className="max-w-lg mx-auto flex justify-between items-center">
        <NavItem active={activeTab === 'recipes'} onClick={() => onTabChange('recipes')} icon={<BookOpen className="w-6 h-6" />} label="Рецепты" />
        <NavItem active={activeTab === 'planner'} onClick={() => onTabChange('planner')} icon={<Calendar className="w-6 h-6" />} label="Планер" />
        <NavItem active={activeTab === 'cart'}    onClick={() => onTabChange('cart')}    icon={<ShoppingCart className="w-6 h-6" />} label="Корзина" />
        <NavItem active={activeTab === 'tracker'} onClick={() => onTabChange('tracker')} icon={<Activity className="w-6 h-6" />} label="Трекер" />
        <NavItem active={activeTab === 'programs'} onClick={() => onTabChange('programs')} icon={<Users className="w-6 h-6" />} label="Программы" />
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout/Shell.tsx src/app/layout/TabBar.tsx
git commit -m "feat(layout): add Shell and TabBar components"
```

---

### Task 6: Wire main.tsx with providers

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Update main.tsx**

Replace current content of `src/main.tsx` with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Shell } from './app/layout/Shell';
import { RepositoryProvider } from './app/providers/RepositoryProvider';
import { DataProvider } from './app/providers/DataProvider';
import { UserProfileProvider } from './app/providers/UserProfileProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RepositoryProvider>
      <DataProvider>
        <UserProfileProvider>
          <Shell>
            <App />
          </Shell>
        </UserProfileProvider>
      </DataProvider>
    </RepositoryProvider>
  </StrictMode>,
);
```

- [ ] **Step 2: Start dev server and verify app loads**

```bash
npm run dev
```

Open `http://localhost:5173` in browser. Expected: app loads with all 5 tabs visible and functional. There will be a double `min-h-screen` wrapper (Shell + App's own outer div) — this is intentional and will be cleaned up in Step 4 (per-tab splits).

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat(app): wire providers and Shell in main.tsx"
```

---

### Task 7: Migrate App.tsx — activeNutritionPlan + TabBar

**Files:**
- Modify: `src/App.tsx`

This task has two independent surgical edits:
1. Replace `activeNutritionPlan` useState + localStorage with `useNutritionPlan()` context
2. Replace inline `<nav>` + `NavItem` function with `<TabBar>`

**Part A — activeNutritionPlan migration:**

- [ ] **Step 1: Add useNutritionPlan import to App.tsx**

At the top of `src/App.tsx`, after the existing imports, add:

```typescript
import { useNutritionPlan } from '@/app/providers/UserProfileContext';
```

- [ ] **Step 2: Replace activeNutritionPlan useState with context hook**

Find the block at approximately line 513 (the `activeNutritionPlan` useState declaration):

```typescript
// REMOVE this block (~lines 513–525):
const [activeNutritionPlan, setActiveNutritionPlan] = useState<{
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
} | null>(null);
```

Add in its place (right after the other `useState` declarations, before `handleStartRecipeSelection`):

```typescript
const { activeNutritionPlan, setActivePlan } = useNutritionPlan();
```

- [ ] **Step 3: Remove localStorage read of activeNutritionPlan from useEffect**

Find the `useEffect` block at approximately lines 713–731 that reads from localStorage. It looks like:

```typescript
useEffect(() => {
  const savedPlan = localStorage.getItem('activeNutritionPlan');
  if (savedPlan) {
    try {
      setActiveNutritionPlan(JSON.parse(savedPlan));
    } catch (e) {
      console.error("Error parsing saved plan:", e);
    }
  }

  const savedCategories = localStorage.getItem('availableCategories');
  ...
}, []);
```

Remove only the `savedPlan` block (lines from `const savedPlan =` through the closing `}`). Keep the `savedCategories` block intact. Result:

```typescript
useEffect(() => {
  const savedCategories = localStorage.getItem('availableCategories');
  if (savedCategories) {
    try {
      setAvailableCategories(JSON.parse(savedCategories));
    } catch (e) {
      console.error("Error parsing saved categories:", e);
    }
  }
}, []);
```

- [ ] **Step 4: Replace all 4 setActiveNutritionPlan call sites**

There are 4 places in App.tsx where `setActiveNutritionPlan` is called. Replace each:

**Call site 1** (~line 7106) — creating a custom plan (note: original code missing localStorage.setItem — this is a pre-existing bug that is now fixed by using the repo):

```typescript
// BEFORE:
setActiveNutritionPlan({
  ...customPlanForm,
  isCustom: true,
  programId: docRef.id,
  allowedProducts: [],
  forbiddenProducts: []
});

// AFTER:
void setActivePlan({
  ...customPlanForm,
  isCustom: true,
  programId: docRef.id,
  allowedProducts: [],
  forbiddenProducts: [],
});
```

**Call site 2** (~line 7131) — resetting to default (remove localStorage.removeItem):

```typescript
// BEFORE:
setActiveNutritionPlan(null);
localStorage.removeItem('activeNutritionPlan');

// AFTER:
void setActivePlan(null);
```

**Call site 3** (~line 7164) — selecting a program plan (remove localStorage.setItem):

```typescript
// BEFORE:
setActiveNutritionPlan(plan);
localStorage.setItem('activeNutritionPlan', JSON.stringify(plan));

// AFTER:
void setActivePlan(plan);
```

**Call site 4** (~line 7207) — selecting a subfolder plan (remove localStorage.setItem):

```typescript
// BEFORE:
setActiveNutritionPlan(plan);
localStorage.setItem('activeNutritionPlan', JSON.stringify(plan));

// AFTER:
void setActivePlan(plan);
```

**Part B — TabBar extraction:**

- [ ] **Step 5: Add TabBar import to App.tsx**

After the existing imports, add:

```typescript
import { TabBar } from '@/app/layout/TabBar';
```

- [ ] **Step 6: Replace inline nav with TabBar**

Find the inline `<nav>` block at approximately lines 6412–6446:

```tsx
{/* Navigation - Always at the bottom */}
<nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-zinc-200 px-4 py-3 z-50">
  <div className="max-w-lg mx-auto flex justify-between items-center">
    <NavItem
      active={activeTab === 'recipes'}
      onClick={() => setActiveTab('recipes')}
      icon={<BookOpen className="w-6 h-6" />}
      label="Рецепты"
    />
    <NavItem
      active={activeTab === 'planner'}
      onClick={() => setActiveTab('planner')}
      icon={<Calendar className="w-6 h-6" />}
      label="Планер"
    />
    <NavItem
      active={activeTab === 'cart'}
      onClick={() => setActiveTab('cart')}
      icon={<ShoppingCart className="w-6 h-6" />}
      label="Корзина"
    />
    <NavItem
      active={activeTab === 'tracker'}
      onClick={() => setActiveTab('tracker')}
      icon={<Activity className="w-6 h-6" />}
      label="Трекер"
    />
    <NavItem
      active={activeTab === 'programs'}
      onClick={() => setActiveTab('programs')}
      icon={<Users className="w-6 h-6" />}
      label="Программы"
    />
  </div>
</nav>
```

Replace with:

```tsx
<TabBar activeTab={activeTab} onTabChange={setActiveTab} />
```

- [ ] **Step 7: Remove the NavItem function from App.tsx**

Find and delete the `NavItem` function definition at approximately lines 7273–7293:

```typescript
function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all duration-200 min-w-[64px]",
        active
          ? "text-emerald-600"
          : "text-zinc-400 hover:text-zinc-600"
      )}
    >
      <div className={cn(
        "p-1 rounded-lg transition-colors",
        active ? "bg-emerald-50" : "bg-transparent"
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 9: Run all tests**

```bash
npx vitest run
```

Expected: all 86+ tests still pass (no regressions).

- [ ] **Step 10: Smoke-test in browser**

```bash
npm run dev
```

Check:
- All 5 tabs navigate correctly
- Active nutrition plan persists across page reload (now stored in Firestore `settings/plan`, not localStorage)
- No console errors

- [ ] **Step 11: Commit**

```bash
git add src/App.tsx
git commit -m "refactor(app): migrate activeNutritionPlan to context; extract TabBar"
```

---

### Task 8: Update vitest.config.ts coverage includes

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Update coverage include list**

Open `vitest.config.ts`. Current `coverage.include` is:

```typescript
include: [
  'src/shared/domain/**',
  'src/features/cart/services/**',
  'src/infrastructure/firestore/converters.ts',
  'src/infrastructure/testing/**',
  'src/infrastructure/LocalStorageNutritionPlanRepository.ts',
],
```

Replace with:

```typescript
include: [
  'src/shared/domain/**',
  'src/features/cart/services/**',
  'src/infrastructure/firestore/converters.ts',
  'src/infrastructure/firestore/FirestoreNutritionPlanRepository.ts',
  'src/infrastructure/testing/**',
  'src/infrastructure/LocalStorageNutritionPlanRepository.ts',
  'src/app/providers/**',
  'src/app/layout/**',
],
```

- [ ] **Step 2: Run coverage to confirm new files appear**

```bash
npx vitest run --coverage
```

Expected: coverage table shows entries for `src/app/providers/` and `src/app/layout/`.

- [ ] **Step 3: Run full test suite to confirm green**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts
git commit -m "chore(test): add coverage includes for providers and layout"
```

---

## Self-Review

**Spec coverage:**

| Requirement (ROADMAP) | Task |
|---|---|
| `RepositoryProvider.tsx` — инъекция Firestore-реализаций | Task 2 |
| `DataProvider.tsx` — подписка на репозитории | Task 3 |
| `UserProfileProvider.tsx` — профиль + activeNutritionPlan | Task 4 |
| `Shell.tsx` — layout wrapper | Task 5 |
| `TabBar.tsx` — навигация по 5 вкладкам | Task 5 |
| Перенос `activeNutritionPlan` из localStorage в Firestore | Tasks 1 + 7 |
| Обновить `main.tsx` — обернуть App провайдерами | Task 6 |
| Тесты провайдеров с fake-репозиториями | Tasks 3 + 4 |

**Placeholder scan:** No TBDs, no "add appropriate error handling", all code blocks are complete. ✅

**Type consistency:**
- `Tab` type is imported from `@/shared/domain/types` in `TabBar.tsx` — matches the type used in `App.tsx`. ✅
- `ActiveNutritionPlan` — same type used in `UserProfileContext`, `UserProfileProvider`, `FirestoreNutritionPlanRepository`. ✅
- `setActivePlan` name is consistent across `UserProfileContext.ts`, `UserProfileProvider.tsx`, and App.tsx call sites. ✅
- `useNutritionPlan()` hook name is consistent between context file and App.tsx import. ✅
