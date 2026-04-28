# Phase 1b: Service Layer — Repository Interfaces & Firestore Implementations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define typed repository interfaces for every Firestore collection and singleton document, provide fake (in-memory) implementations for unit tests, ship real Firestore implementations, and replace the three inline `BASIC_KEYWORDS` arrays in `App.tsx` with an import from the existing `staples.ts` module.

**Architecture:** Interfaces live in `src/services/`, Firestore implementations in `src/infrastructure/firestore/`, shared in-memory fakes in `src/infrastructure/testing/`. App.tsx is NOT wired to the new repositories yet — that happens in Phase 1 step 3. This phase only defines the contracts, proves them with tests, and ships the Firestore implementations alongside.

**Tech Stack:** TypeScript strict, Vitest 4.x (already set up), `firebase/firestore` SDK already installed.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/App.tsx` | Modify (3 lines) | Replace three inline `BASIC_KEYWORDS` arrays with `import { isStaple }` from `staples.ts` |
| `src/infrastructure/firestore/converters.ts` | Create | `timestampToISO` utility: Firestore `Timestamp` or string → ISO string |
| `src/infrastructure/firestore/__tests__/converters.test.ts` | Create | 100% coverage for converters |
| `src/services/RecipesRepository.ts` | Create | Interface: subscribeAll, add, update, delete, getById |
| `src/services/PlannerRepository.ts` | Create | Interface: subscribeAll, add, delete |
| `src/services/ProgramsRepository.ts` | Create | Interface: subscribeAll, add, update, delete, getById |
| `src/services/CartRepository.ts` | Create | Interface: subscribeAll, add, update, delete, deleteAll |
| `src/services/UserProfileRepository.ts` | Create | Interface: subscribe, save (singleton doc) |
| `src/services/NutritionPlanRepository.ts` | Create | Interface: get, set (localStorage-backed for now) |
| `src/infrastructure/testing/FakeRecipesRepository.ts` | Create | In-memory implementation of RecipesRepository |
| `src/infrastructure/testing/FakePlannerRepository.ts` | Create | In-memory implementation of PlannerRepository |
| `src/infrastructure/testing/FakeProgramsRepository.ts` | Create | In-memory implementation of ProgramsRepository |
| `src/infrastructure/testing/FakeCartRepository.ts` | Create | In-memory implementation of CartRepository |
| `src/infrastructure/testing/FakeUserProfileRepository.ts` | Create | In-memory implementation of UserProfileRepository |
| `src/infrastructure/testing/FakeNutritionPlanRepository.ts` | Create | In-memory implementation of NutritionPlanRepository |
| `src/infrastructure/testing/__tests__/FakeRecipesRepository.test.ts` | Create | Contract tests for FakeRecipesRepository |
| `src/infrastructure/testing/__tests__/FakePlannerRepository.test.ts` | Create | Contract tests for FakePlannerRepository |
| `src/infrastructure/testing/__tests__/FakeProgramsRepository.test.ts` | Create | Contract tests for FakeProgramsRepository |
| `src/infrastructure/testing/__tests__/FakeCartRepository.test.ts` | Create | Contract tests for FakeCartRepository |
| `src/infrastructure/testing/__tests__/FakeUserProfileRepository.test.ts` | Create | Contract tests for FakeUserProfileRepository |
| `src/infrastructure/testing/__tests__/FakeNutritionPlanRepository.test.ts` | Create | Contract tests for FakeNutritionPlanRepository |
| `src/infrastructure/LocalStorageNutritionPlanRepository.ts` | Create | localStorage implementation of NutritionPlanRepository |
| `src/infrastructure/__tests__/LocalStorageNutritionPlanRepository.test.ts` | Create | Tests using jsdom localStorage stub |
| `src/infrastructure/firestore/FirestoreRecipesRepository.ts` | Create | Firestore implementation |
| `src/infrastructure/firestore/FirestorePlannerRepository.ts` | Create | Firestore implementation |
| `src/infrastructure/firestore/FirestoreProgramsRepository.ts` | Create | Firestore implementation |
| `src/infrastructure/firestore/FirestoreCartRepository.ts` | Create | Firestore implementation |
| `src/infrastructure/firestore/FirestoreUserProfileRepository.ts` | Create | Firestore implementation |
| `vitest.config.ts` | Modify | Expand coverage `include` for new testable files |

---

## Task 1: Replace BASIC_KEYWORDS in App.tsx

**Files:**
- Modify: `src/App.tsx:593,1946,3481`

No new tests needed — `isStaple` already has 100% coverage from Phase 1a.

- [ ] **Step 1: Add the import to App.tsx**

At line 51 (just below the existing `aiClient` import), add:

```typescript
import { isStaple } from "@/features/cart/services/staples";
```

- [ ] **Step 2: Replace occurrence at line 593**

Find (lines 593–612, inside `addProductsToCart`):
```typescript
const BASIC_KEYWORDS = ['соль', 'сахар', 'перец', 'лук', 'чеснок', 'масло', 'мука', 'сода', 'уксус', 'вода', 'специи', 'приправа'];
```
and the usage:
```typescript
const isBasic = BASIC_KEYWORDS.some(k => name.toLowerCase().includes(k));
```

Replace both lines with a single call:
```typescript
const isBasic = isStaple(name);
```

- [ ] **Step 3: Replace occurrence at line 1946**

Find (inside the Planner's ingredient-map block):
```typescript
const BASIC_KEYWORDS = ['соль', 'сахар', 'перец', 'лук', 'чеснок', 'масло', 'мука', 'сода', 'уксус', 'вода', 'специи', 'приправа'];
```
and:
```typescript
const isBasic = BASIC_KEYWORDS.some(k => lowerIng.includes(k));
```

Replace both lines with:
```typescript
const isBasic = isStaple(ing);
```

- [ ] **Step 4: Replace occurrence at line 3481**

Find (inside `renderCart` → `handleAddManualCartItem`):
```typescript
const BASIC_KEYWORDS = ['соль', 'сахар', 'перец', 'лук', 'чеснок', 'масло', 'мука', 'сода', 'уксус', 'вода', 'специи', 'приправа'];
const isBasic = BASIC_KEYWORDS.some(k => newCartItemName.toLowerCase().includes(k));
```

Replace both lines with:
```typescript
const isBasic = isStaple(newCartItemName);
```

- [ ] **Step 5: Verify — `BASIC_KEYWORDS` appears exactly once in the codebase**

```bash
grep -rn "BASIC_KEYWORDS" src/
```

Expected: exactly 1 match in `src/features/cart/services/staples.ts`.

- [ ] **Step 6: Run lint and tests**

```bash
npm run lint && npm test
```

Expected: 0 TypeScript errors, 32 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: replace inline BASIC_KEYWORDS with isStaple() import"
```

---

## Task 2: Timestamp converter utility

**Files:**
- Create: `src/infrastructure/firestore/converters.ts`
- Create: `src/infrastructure/firestore/__tests__/converters.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/infrastructure/firestore/__tests__/converters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { timestampToISO } from '../converters';

describe('timestampToISO', () => {
  it('passes through an ISO string unchanged', () => {
    const iso = '2026-04-27T10:00:00.000Z';
    expect(timestampToISO(iso)).toBe(iso);
  });

  it('returns current-ish ISO string for null', () => {
    const before = Date.now();
    const result = timestampToISO(null);
    const after = Date.now();
    const ms = new Date(result).getTime();
    expect(ms).toBeGreaterThanOrEqual(before);
    expect(ms).toBeLessThanOrEqual(after);
  });

  it('returns current-ish ISO string for undefined', () => {
    const before = Date.now();
    const result = timestampToISO(undefined);
    const after = Date.now();
    const ms = new Date(result).getTime();
    expect(ms).toBeGreaterThanOrEqual(before);
    expect(ms).toBeLessThanOrEqual(after);
  });

  it('converts a Firestore-Timestamp-shaped object via toDate()', () => {
    const fakeTimestamp = { toDate: () => new Date('2026-01-15T08:30:00.000Z') };
    expect(timestampToISO(fakeTimestamp as never)).toBe('2026-01-15T08:30:00.000Z');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | head -30
```

Expected: FAIL — `Cannot find module '../converters'`.

- [ ] **Step 3: Create the converter**

Create `src/infrastructure/firestore/converters.ts`:

```typescript
type TimestampLike = { toDate(): Date };

export function timestampToISO(
  value: TimestampLike | string | null | undefined
): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  return value.toDate().toISOString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose
```

Expected: 4 new tests pass (36 total).

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/firestore/converters.ts \
        src/infrastructure/firestore/__tests__/converters.test.ts
git commit -m "feat(infra): add timestampToISO converter with tests"
```

---

## Task 3: RecipesRepository — interface, fake, tests

**Files:**
- Create: `src/services/RecipesRepository.ts`
- Create: `src/infrastructure/testing/FakeRecipesRepository.ts`
- Create: `src/infrastructure/testing/__tests__/FakeRecipesRepository.test.ts`

- [ ] **Step 1: Create the interface**

Create `src/services/RecipesRepository.ts`:

```typescript
import type { Recipe } from '@/shared/domain/types';

export interface RecipesRepository {
  subscribeAll(callback: (recipes: Recipe[]) => void): () => void;
  add(data: Omit<Recipe, 'id'>): Promise<string>;
  update(id: string, data: Partial<Omit<Recipe, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Recipe | null>;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/infrastructure/testing/__tests__/FakeRecipesRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeRecipesRepository } from '../FakeRecipesRepository';
import type { Recipe } from '@/shared/domain/types';

const recipe = (): Omit<Recipe, 'id'> => ({
  title: 'Pasta',
  time: '30 мин',
  servings: 2,
  categories: ['Горячее'],
  ingredients: ['Паста 200г'],
  steps: ['Варить 10 минут'],
  macros: { calories: 400, proteins: 15, fats: 5, carbs: 70 },
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('FakeRecipesRepository', () => {
  let repo: FakeRecipesRepository;

  beforeEach(() => {
    repo = new FakeRecipesRepository();
  });

  it('subscribeAll immediately emits empty array', () => {
    const calls: Recipe[][] = [];
    repo.subscribeAll(r => calls.push(r));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([]);
  });

  it('add returns incremental id and notifies subscribers', async () => {
    const calls: Recipe[][] = [];
    repo.subscribeAll(r => calls.push(r));
    const id = await repo.add(recipe());
    expect(id).toBe('1');
    expect(calls).toHaveLength(2);
    expect(calls[1]![0]!.title).toBe('Pasta');
  });

  it('add assigns unique ids for multiple calls', async () => {
    const id1 = await repo.add(recipe());
    const id2 = await repo.add({ ...recipe(), title: 'Risotto' });
    expect(id1).not.toBe(id2);
  });

  it('update changes a field and notifies', async () => {
    const id = await repo.add(recipe());
    const calls: Recipe[][] = [];
    repo.subscribeAll(r => calls.push(r));
    await repo.update(id, { title: 'Risotto' });
    expect(calls[calls.length - 1]![0]!.title).toBe('Risotto');
  });

  it('update on unknown id is a no-op', async () => {
    await expect(repo.update('ghost', { title: 'X' })).resolves.toBeUndefined();
  });

  it('delete removes recipe and notifies', async () => {
    const id = await repo.add(recipe());
    await repo.delete(id);
    expect(await repo.getById(id)).toBeNull();
  });

  it('getById returns recipe for known id', async () => {
    const id = await repo.add(recipe());
    const r = await repo.getById(id);
    expect(r?.title).toBe('Pasta');
  });

  it('getById returns null for unknown id', async () => {
    expect(await repo.getById('ghost')).toBeNull();
  });

  it('unsubscribe stops future notifications', async () => {
    const calls: Recipe[][] = [];
    const unsub = repo.subscribeAll(r => calls.push(r));
    unsub();
    await repo.add(recipe());
    expect(calls).toHaveLength(1); // only the initial emit
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|Cannot find"
```

Expected: FAIL — `Cannot find module '../FakeRecipesRepository'`.

- [ ] **Step 4: Create the fake implementation**

Create `src/infrastructure/testing/FakeRecipesRepository.ts`:

```typescript
import type { RecipesRepository } from '@/services/RecipesRepository';
import type { Recipe } from '@/shared/domain/types';

export class FakeRecipesRepository implements RecipesRepository {
  private items: Recipe[] = [];
  private listeners = new Set<(recipes: Recipe[]) => void>();
  private counter = 0;

  private emit(): void {
    const snapshot = [...this.items];
    this.listeners.forEach(cb => cb(snapshot));
  }

  subscribeAll(callback: (recipes: Recipe[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.items]);
    return () => this.listeners.delete(callback);
  }

  async add(data: Omit<Recipe, 'id'>): Promise<string> {
    const id = String(++this.counter);
    this.items.push({ id, ...data });
    this.emit();
    return id;
  }

  async update(id: string, data: Partial<Omit<Recipe, 'id'>>): Promise<void> {
    const idx = this.items.findIndex(r => r.id === id);
    if (idx === -1) return;
    this.items[idx] = { ...this.items[idx]!, ...data };
    this.emit();
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter(r => r.id !== id);
    this.emit();
  }

  async getById(id: string): Promise<Recipe | null> {
    return this.items.find(r => r.id === id) ?? null;
  }

  reset(): void {
    this.items = [];
    this.listeners.clear();
    this.counter = 0;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose
```

Expected: 9 new tests pass (45 total).

- [ ] **Step 6: Commit**

```bash
git add src/services/RecipesRepository.ts \
        src/infrastructure/testing/FakeRecipesRepository.ts \
        src/infrastructure/testing/__tests__/FakeRecipesRepository.test.ts
git commit -m "feat(infra): add RecipesRepository interface and fake with tests"
```

---

## Task 4: PlannerRepository — interface, fake, tests

**Files:**
- Create: `src/services/PlannerRepository.ts`
- Create: `src/infrastructure/testing/FakePlannerRepository.ts`
- Create: `src/infrastructure/testing/__tests__/FakePlannerRepository.test.ts`

- [ ] **Step 1: Create the interface**

Create `src/services/PlannerRepository.ts`:

```typescript
import type { PlannerEntry } from '@/shared/domain/types';

export interface PlannerRepository {
  subscribeAll(callback: (entries: PlannerEntry[]) => void): () => void;
  add(data: Omit<PlannerEntry, 'id'>): Promise<string>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/infrastructure/testing/__tests__/FakePlannerRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { FakePlannerRepository } from '../FakePlannerRepository';
import type { PlannerEntry } from '@/shared/domain/types';

const entry = (): Omit<PlannerEntry, 'id'> => ({
  date: '2026-04-27',
  mealType: 'Завтрак',
  type: 'recipe',
  recipeId: 'r1',
});

describe('FakePlannerRepository', () => {
  let repo: FakePlannerRepository;

  beforeEach(() => {
    repo = new FakePlannerRepository();
  });

  it('subscribeAll immediately emits empty array', () => {
    const calls: PlannerEntry[][] = [];
    repo.subscribeAll(e => calls.push(e));
    expect(calls[0]).toEqual([]);
  });

  it('add returns id and notifies subscribers', async () => {
    const calls: PlannerEntry[][] = [];
    repo.subscribeAll(e => calls.push(e));
    const id = await repo.add(entry());
    expect(id).toBe('1');
    expect(calls[1]![0]!.recipeId).toBe('r1');
  });

  it('delete removes entry and notifies', async () => {
    const id = await repo.add(entry());
    const calls: PlannerEntry[][] = [];
    repo.subscribeAll(e => calls.push(e));
    await repo.delete(id);
    expect(calls[calls.length - 1]).toEqual([]);
  });

  it('unsubscribe stops notifications', async () => {
    const calls: PlannerEntry[][] = [];
    const unsub = repo.subscribeAll(e => calls.push(e));
    unsub();
    await repo.add(entry());
    expect(calls).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|Cannot find"
```

Expected: FAIL — `Cannot find module '../FakePlannerRepository'`.

- [ ] **Step 4: Create the fake implementation**

Create `src/infrastructure/testing/FakePlannerRepository.ts`:

```typescript
import type { PlannerRepository } from '@/services/PlannerRepository';
import type { PlannerEntry } from '@/shared/domain/types';

export class FakePlannerRepository implements PlannerRepository {
  private items: PlannerEntry[] = [];
  private listeners = new Set<(entries: PlannerEntry[]) => void>();
  private counter = 0;

  private emit(): void {
    const snapshot = [...this.items];
    this.listeners.forEach(cb => cb(snapshot));
  }

  subscribeAll(callback: (entries: PlannerEntry[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.items]);
    return () => this.listeners.delete(callback);
  }

  async add(data: Omit<PlannerEntry, 'id'>): Promise<string> {
    const id = String(++this.counter);
    this.items.push({ id, ...data });
    this.emit();
    return id;
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter(e => e.id !== id);
    this.emit();
  }

  reset(): void {
    this.items = [];
    this.listeners.clear();
    this.counter = 0;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose
```

Expected: 4 new tests pass (49 total).

- [ ] **Step 6: Commit**

```bash
git add src/services/PlannerRepository.ts \
        src/infrastructure/testing/FakePlannerRepository.ts \
        src/infrastructure/testing/__tests__/FakePlannerRepository.test.ts
git commit -m "feat(infra): add PlannerRepository interface and fake with tests"
```

---

## Task 5: ProgramsRepository — interface, fake, tests

**Files:**
- Create: `src/services/ProgramsRepository.ts`
- Create: `src/infrastructure/testing/FakeProgramsRepository.ts`
- Create: `src/infrastructure/testing/__tests__/FakeProgramsRepository.test.ts`

- [ ] **Step 1: Create the interface**

Create `src/services/ProgramsRepository.ts`:

```typescript
import type { Program } from '@/shared/domain/types';

export interface ProgramsRepository {
  subscribeAll(callback: (programs: Program[]) => void): () => void;
  add(data: Omit<Program, 'id'>): Promise<string>;
  update(id: string, data: Partial<Omit<Program, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<Program | null>;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/infrastructure/testing/__tests__/FakeProgramsRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeProgramsRepository } from '../FakeProgramsRepository';
import type { Program } from '@/shared/domain/types';

const program = (): Omit<Program, 'id'> => ({
  name: 'Похудение',
  description: 'Программа на 4 недели',
  creator: 'Тест',
  link: '',
  recipeIds: [],
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('FakeProgramsRepository', () => {
  let repo: FakeProgramsRepository;

  beforeEach(() => {
    repo = new FakeProgramsRepository();
  });

  it('subscribeAll immediately emits empty array', () => {
    const calls: Program[][] = [];
    repo.subscribeAll(p => calls.push(p));
    expect(calls[0]).toEqual([]);
  });

  it('add returns id and notifies', async () => {
    const calls: Program[][] = [];
    repo.subscribeAll(p => calls.push(p));
    const id = await repo.add(program());
    expect(id).toBe('1');
    expect(calls[1]![0]!.name).toBe('Похудение');
  });

  it('update changes a field', async () => {
    const id = await repo.add(program());
    await repo.update(id, { name: 'Набор массы' });
    const p = await repo.getById(id);
    expect(p?.name).toBe('Набор массы');
  });

  it('update on unknown id is a no-op', async () => {
    await expect(repo.update('ghost', { name: 'X' })).resolves.toBeUndefined();
  });

  it('delete removes program', async () => {
    const id = await repo.add(program());
    await repo.delete(id);
    expect(await repo.getById(id)).toBeNull();
  });

  it('getById returns null for unknown id', async () => {
    expect(await repo.getById('ghost')).toBeNull();
  });

  it('unsubscribe stops notifications', async () => {
    const calls: Program[][] = [];
    const unsub = repo.subscribeAll(p => calls.push(p));
    unsub();
    await repo.add(program());
    expect(calls).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|Cannot find"
```

Expected: FAIL — `Cannot find module '../FakeProgramsRepository'`.

- [ ] **Step 4: Create the fake implementation**

Create `src/infrastructure/testing/FakeProgramsRepository.ts`:

```typescript
import type { ProgramsRepository } from '@/services/ProgramsRepository';
import type { Program } from '@/shared/domain/types';

export class FakeProgramsRepository implements ProgramsRepository {
  private items: Program[] = [];
  private listeners = new Set<(programs: Program[]) => void>();
  private counter = 0;

  private emit(): void {
    const snapshot = [...this.items];
    this.listeners.forEach(cb => cb(snapshot));
  }

  subscribeAll(callback: (programs: Program[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.items]);
    return () => this.listeners.delete(callback);
  }

  async add(data: Omit<Program, 'id'>): Promise<string> {
    const id = String(++this.counter);
    this.items.push({ id, ...data });
    this.emit();
    return id;
  }

  async update(id: string, data: Partial<Omit<Program, 'id'>>): Promise<void> {
    const idx = this.items.findIndex(p => p.id === id);
    if (idx === -1) return;
    this.items[idx] = { ...this.items[idx]!, ...data };
    this.emit();
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter(p => p.id !== id);
    this.emit();
  }

  async getById(id: string): Promise<Program | null> {
    return this.items.find(p => p.id === id) ?? null;
  }

  reset(): void {
    this.items = [];
    this.listeners.clear();
    this.counter = 0;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose
```

Expected: 7 new tests pass (56 total).

- [ ] **Step 6: Commit**

```bash
git add src/services/ProgramsRepository.ts \
        src/infrastructure/testing/FakeProgramsRepository.ts \
        src/infrastructure/testing/__tests__/FakeProgramsRepository.test.ts
git commit -m "feat(infra): add ProgramsRepository interface and fake with tests"
```

---

## Task 6: CartRepository — interface, fake, tests

**Files:**
- Create: `src/services/CartRepository.ts`
- Create: `src/infrastructure/testing/FakeCartRepository.ts`
- Create: `src/infrastructure/testing/__tests__/FakeCartRepository.test.ts`

- [ ] **Step 1: Create the interface**

Create `src/services/CartRepository.ts`:

```typescript
import type { CartItem } from '@/shared/domain/types';

export interface CartRepository {
  subscribeAll(callback: (items: CartItem[]) => void): () => void;
  add(data: Omit<CartItem, 'id'>): Promise<string>;
  update(id: string, data: Partial<Omit<CartItem, 'id'>>): Promise<void>;
  delete(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/infrastructure/testing/__tests__/FakeCartRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeCartRepository } from '../FakeCartRepository';
import type { CartItem } from '@/shared/domain/types';

const item = (): Omit<CartItem, 'id'> => ({
  name: 'Молоко',
  amount: '1л',
  sourceDishes: ['Суп'],
  checked: false,
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('FakeCartRepository', () => {
  let repo: FakeCartRepository;

  beforeEach(() => {
    repo = new FakeCartRepository();
  });

  it('subscribeAll immediately emits empty array', () => {
    const calls: CartItem[][] = [];
    repo.subscribeAll(i => calls.push(i));
    expect(calls[0]).toEqual([]);
  });

  it('add returns id and notifies', async () => {
    const calls: CartItem[][] = [];
    repo.subscribeAll(i => calls.push(i));
    const id = await repo.add(item());
    expect(id).toBe('1');
    expect(calls[1]![0]!.name).toBe('Молоко');
  });

  it('update changes a field', async () => {
    const id = await repo.add(item());
    await repo.update(id, { checked: true });
    const calls: CartItem[][] = [];
    repo.subscribeAll(i => calls.push(i));
    expect(calls[0]![0]!.checked).toBe(true);
  });

  it('update on unknown id is a no-op', async () => {
    await expect(repo.update('ghost', { checked: true })).resolves.toBeUndefined();
  });

  it('delete removes item', async () => {
    const id = await repo.add(item());
    await repo.delete(id);
    const calls: CartItem[][] = [];
    repo.subscribeAll(i => calls.push(i));
    expect(calls[0]).toEqual([]);
  });

  it('deleteAll removes all items', async () => {
    await repo.add(item());
    await repo.add({ ...item(), name: 'Кефир' });
    await repo.deleteAll();
    const calls: CartItem[][] = [];
    repo.subscribeAll(i => calls.push(i));
    expect(calls[0]).toEqual([]);
  });

  it('unsubscribe stops notifications', async () => {
    const calls: CartItem[][] = [];
    const unsub = repo.subscribeAll(i => calls.push(i));
    unsub();
    await repo.add(item());
    expect(calls).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|Cannot find"
```

Expected: FAIL — `Cannot find module '../FakeCartRepository'`.

- [ ] **Step 4: Create the fake implementation**

Create `src/infrastructure/testing/FakeCartRepository.ts`:

```typescript
import type { CartRepository } from '@/services/CartRepository';
import type { CartItem } from '@/shared/domain/types';

export class FakeCartRepository implements CartRepository {
  private items: CartItem[] = [];
  private listeners = new Set<(items: CartItem[]) => void>();
  private counter = 0;

  private emit(): void {
    const snapshot = [...this.items];
    this.listeners.forEach(cb => cb(snapshot));
  }

  subscribeAll(callback: (items: CartItem[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.items]);
    return () => this.listeners.delete(callback);
  }

  async add(data: Omit<CartItem, 'id'>): Promise<string> {
    const id = String(++this.counter);
    this.items.push({ id, ...data });
    this.emit();
    return id;
  }

  async update(id: string, data: Partial<Omit<CartItem, 'id'>>): Promise<void> {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return;
    this.items[idx] = { ...this.items[idx]!, ...data };
    this.emit();
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter(i => i.id !== id);
    this.emit();
  }

  async deleteAll(): Promise<void> {
    this.items = [];
    this.emit();
  }

  reset(): void {
    this.items = [];
    this.listeners.clear();
    this.counter = 0;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose
```

Expected: 7 new tests pass (63 total).

- [ ] **Step 6: Commit**

```bash
git add src/services/CartRepository.ts \
        src/infrastructure/testing/FakeCartRepository.ts \
        src/infrastructure/testing/__tests__/FakeCartRepository.test.ts
git commit -m "feat(infra): add CartRepository interface and fake with tests"
```

---

## Task 7: UserProfileRepository — interface, fake, tests

**Files:**
- Create: `src/services/UserProfileRepository.ts`
- Create: `src/infrastructure/testing/FakeUserProfileRepository.ts`
- Create: `src/infrastructure/testing/__tests__/FakeUserProfileRepository.test.ts`

- [ ] **Step 1: Create the interface**

Create `src/services/UserProfileRepository.ts`:

```typescript
import type { UserProfile } from '@/shared/domain/types';

export interface UserProfileRepository {
  subscribe(callback: (profile: UserProfile | null) => void): () => void;
  save(profile: UserProfile): Promise<void>;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/infrastructure/testing/__tests__/FakeUserProfileRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeUserProfileRepository } from '../FakeUserProfileRepository';
import type { UserProfile } from '@/shared/domain/types';

const profile = (): UserProfile => ({
  name: 'Анна',
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

describe('FakeUserProfileRepository', () => {
  let repo: FakeUserProfileRepository;

  beforeEach(() => {
    repo = new FakeUserProfileRepository();
  });

  it('subscribe immediately emits null when no profile saved', () => {
    const calls: (UserProfile | null)[] = [];
    repo.subscribe(p => calls.push(p));
    expect(calls[0]).toBeNull();
  });

  it('save persists profile and notifies subscriber', async () => {
    const calls: (UserProfile | null)[] = [];
    repo.subscribe(p => calls.push(p));
    await repo.save(profile());
    expect(calls).toHaveLength(2);
    expect(calls[1]!.name).toBe('Анна');
  });

  it('subsequent saves overwrite previous profile', async () => {
    await repo.save(profile());
    await repo.save({ ...profile(), name: 'Мария' });
    const calls: (UserProfile | null)[] = [];
    repo.subscribe(p => calls.push(p));
    expect(calls[0]!.name).toBe('Мария');
  });

  it('unsubscribe stops notifications', async () => {
    const calls: (UserProfile | null)[] = [];
    const unsub = repo.subscribe(p => calls.push(p));
    unsub();
    await repo.save(profile());
    expect(calls).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|Cannot find"
```

Expected: FAIL — `Cannot find module '../FakeUserProfileRepository'`.

- [ ] **Step 4: Create the fake implementation**

Create `src/infrastructure/testing/FakeUserProfileRepository.ts`:

```typescript
import type { UserProfileRepository } from '@/services/UserProfileRepository';
import type { UserProfile } from '@/shared/domain/types';

export class FakeUserProfileRepository implements UserProfileRepository {
  private current: UserProfile | null = null;
  private listeners = new Set<(profile: UserProfile | null) => void>();

  private emit(): void {
    this.listeners.forEach(cb => cb(this.current));
  }

  subscribe(callback: (profile: UserProfile | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.current);
    return () => this.listeners.delete(callback);
  }

  async save(profile: UserProfile): Promise<void> {
    this.current = { ...profile };
    this.emit();
  }

  reset(): void {
    this.current = null;
    this.listeners.clear();
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose
```

Expected: 4 new tests pass (67 total).

- [ ] **Step 6: Commit**

```bash
git add src/services/UserProfileRepository.ts \
        src/infrastructure/testing/FakeUserProfileRepository.ts \
        src/infrastructure/testing/__tests__/FakeUserProfileRepository.test.ts
git commit -m "feat(infra): add UserProfileRepository interface and fake with tests"
```

---

## Task 8: NutritionPlanRepository — interface, localStorage impl, fake, tests

**Files:**
- Create: `src/services/NutritionPlanRepository.ts`
- Create: `src/infrastructure/LocalStorageNutritionPlanRepository.ts`
- Create: `src/infrastructure/__tests__/LocalStorageNutritionPlanRepository.test.ts`
- Create: `src/infrastructure/testing/FakeNutritionPlanRepository.ts`
- Create: `src/infrastructure/testing/__tests__/FakeNutritionPlanRepository.test.ts`

- [ ] **Step 1: Create the interface**

Create `src/services/NutritionPlanRepository.ts`:

```typescript
import type { ActiveNutritionPlan } from '@/shared/domain/types';

export interface NutritionPlanRepository {
  get(): Promise<ActiveNutritionPlan | null>;
  set(plan: ActiveNutritionPlan | null): Promise<void>;
}
```

- [ ] **Step 2: Write the failing tests for the localStorage implementation**

The localStorage tests need a jsdom environment. Update vitest.config.ts to allow per-file environment overrides (add `environmentMatchGlobs` support). Actually, the simplest approach is to add a `@vitest-environment jsdom` docblock comment to the test file. But our vitest config uses `environment: 'node'` globally.

We need to enable `environmentMatchGlobs` in vitest.config.ts. Alternatively, add the docblock comment `// @vitest-environment jsdom` at the top of the test file (vitest supports this per-file override).

Create `src/infrastructure/__tests__/LocalStorageNutritionPlanRepository.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageNutritionPlanRepository } from '../LocalStorageNutritionPlanRepository';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

const plan = (): ActiveNutritionPlan => ({
  name: 'Похудение',
  calories: 1500,
  proteins: 120,
  fats: 50,
  carbs: 150,
  isCustom: false,
  programId: 'p1',
});

describe('LocalStorageNutritionPlanRepository', () => {
  let repo: LocalStorageNutritionPlanRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageNutritionPlanRepository();
  });

  it('get returns null when localStorage is empty', async () => {
    expect(await repo.get()).toBeNull();
  });

  it('set then get returns the stored plan', async () => {
    await repo.set(plan());
    const result = await repo.get();
    expect(result?.name).toBe('Похудение');
    expect(result?.calories).toBe(1500);
  });

  it('set with null clears the stored plan', async () => {
    await repo.set(plan());
    await repo.set(null);
    expect(await repo.get()).toBeNull();
  });

  it('get returns null on corrupted localStorage data', async () => {
    localStorage.setItem('activeNutritionPlan', 'not-valid-json{{{');
    expect(await repo.get()).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|Cannot find"
```

Expected: FAIL — `Cannot find module '../LocalStorageNutritionPlanRepository'`.

- [ ] **Step 4: Create the localStorage implementation**

Create `src/infrastructure/LocalStorageNutritionPlanRepository.ts`:

```typescript
import type { NutritionPlanRepository } from '@/services/NutritionPlanRepository';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

const KEY = 'activeNutritionPlan';

export class LocalStorageNutritionPlanRepository implements NutritionPlanRepository {
  async get(): Promise<ActiveNutritionPlan | null> {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ActiveNutritionPlan;
    } catch {
      return null;
    }
  }

  async set(plan: ActiveNutritionPlan | null): Promise<void> {
    if (plan === null) {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, JSON.stringify(plan));
    }
  }
}
```

- [ ] **Step 5: Run tests to verify localStorage tests pass**

```bash
npm test -- --reporter=verbose
```

Expected: 4 new tests pass.

- [ ] **Step 6: Write the failing tests for the fake**

Create `src/infrastructure/testing/__tests__/FakeNutritionPlanRepository.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeNutritionPlanRepository } from '../FakeNutritionPlanRepository';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

const plan = (): ActiveNutritionPlan => ({
  name: 'Тест',
  calories: 2000,
  proteins: 150,
  fats: 70,
  carbs: 200,
  isCustom: true,
});

describe('FakeNutritionPlanRepository', () => {
  let repo: FakeNutritionPlanRepository;

  beforeEach(() => {
    repo = new FakeNutritionPlanRepository();
  });

  it('get returns null initially', async () => {
    expect(await repo.get()).toBeNull();
  });

  it('set then get returns the plan', async () => {
    await repo.set(plan());
    expect((await repo.get())?.name).toBe('Тест');
  });

  it('set with null clears the plan', async () => {
    await repo.set(plan());
    await repo.set(null);
    expect(await repo.get()).toBeNull();
  });
});
```

- [ ] **Step 7: Run tests to verify fake tests fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|Cannot find"
```

Expected: FAIL — `Cannot find module '../FakeNutritionPlanRepository'`.

- [ ] **Step 8: Create the fake implementation**

Create `src/infrastructure/testing/FakeNutritionPlanRepository.ts`:

```typescript
import type { NutritionPlanRepository } from '@/services/NutritionPlanRepository';
import type { ActiveNutritionPlan } from '@/shared/domain/types';

export class FakeNutritionPlanRepository implements NutritionPlanRepository {
  private current: ActiveNutritionPlan | null = null;

  async get(): Promise<ActiveNutritionPlan | null> {
    return this.current;
  }

  async set(plan: ActiveNutritionPlan | null): Promise<void> {
    this.current = plan;
  }

  reset(): void {
    this.current = null;
  }
}
```

- [ ] **Step 9: Run all tests to verify they pass**

```bash
npm test -- --reporter=verbose
```

Expected: 7 new tests pass (74+ total).

- [ ] **Step 10: Commit**

```bash
git add src/services/NutritionPlanRepository.ts \
        src/infrastructure/LocalStorageNutritionPlanRepository.ts \
        src/infrastructure/__tests__/LocalStorageNutritionPlanRepository.test.ts \
        src/infrastructure/testing/FakeNutritionPlanRepository.ts \
        src/infrastructure/testing/__tests__/FakeNutritionPlanRepository.test.ts
git commit -m "feat(infra): add NutritionPlanRepository interface, localStorage impl, fake, tests"
```

---

## Task 9: Firestore implementations

**Files:**
- Create: `src/infrastructure/firestore/FirestoreRecipesRepository.ts`
- Create: `src/infrastructure/firestore/FirestorePlannerRepository.ts`
- Create: `src/infrastructure/firestore/FirestoreProgramsRepository.ts`
- Create: `src/infrastructure/firestore/FirestoreCartRepository.ts`
- Create: `src/infrastructure/firestore/FirestoreUserProfileRepository.ts`

These implementations connect to a live Firestore instance (no unit tests — the contract is already verified by the fakes). They mirror exactly what `App.tsx` currently does inline.

- [ ] **Step 1: Create FirestoreRecipesRepository**

Create `src/infrastructure/firestore/FirestoreRecipesRepository.ts`:

```typescript
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, getDoc,
} from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { Recipe } from '@/shared/domain/types';
import type { RecipesRepository } from '@/services/RecipesRepository';
import { timestampToISO } from './converters';

function fromFirestore(id: string, data: Record<string, unknown>): Recipe {
  return {
    id,
    title: data['title'] as string,
    image: data['image'] as string | undefined,
    sourceUrl: data['sourceUrl'] as string | undefined,
    author: data['author'] as string | undefined,
    time: data['time'] as string,
    servings: data['servings'] as number,
    categories: data['categories'] as string[],
    ingredients: data['ingredients'] as string[],
    steps: data['steps'] as string[],
    macros: data['macros'] as Recipe['macros'],
    substitutions: data['substitutions'] as string | undefined,
    isFavorite: data['isFavorite'] as boolean | undefined,
    createdAt: timestampToISO(data['createdAt'] as never),
  };
}

export class FirestoreRecipesRepository implements RecipesRepository {
  subscribeAll(callback: (recipes: Recipe[]) => void): () => void {
    return onSnapshot(query(collection(db, 'recipes')), snapshot => {
      const recipes: Recipe[] = [];
      snapshot.forEach(d => recipes.push(fromFirestore(d.id, d.data())));
      callback(recipes);
    });
  }

  async add(data: Omit<Recipe, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'recipes'), data);
    return ref.id;
  }

  async update(id: string, data: Partial<Omit<Recipe, 'id'>>): Promise<void> {
    await updateDoc(doc(db, 'recipes', id), data as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'recipes', id));
  }

  async getById(id: string): Promise<Recipe | null> {
    const snap = await getDoc(doc(db, 'recipes', id));
    if (!snap.exists()) return null;
    return fromFirestore(snap.id, snap.data());
  }
}
```

- [ ] **Step 2: Create FirestorePlannerRepository**

Create `src/infrastructure/firestore/FirestorePlannerRepository.ts`:

```typescript
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query,
} from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { PlannerEntry } from '@/shared/domain/types';
import type { PlannerRepository } from '@/services/PlannerRepository';

function fromFirestore(id: string, data: Record<string, unknown>): PlannerEntry {
  return {
    id,
    date: data['date'] as string,
    mealType: data['mealType'] as string,
    type: data['type'] as 'recipe' | 'product',
    recipeId: data['recipeId'] as string | undefined,
    productName: data['productName'] as string | undefined,
    amount: data['amount'] as string | undefined,
    macros: data['macros'] as PlannerEntry['macros'],
  };
}

export class FirestorePlannerRepository implements PlannerRepository {
  subscribeAll(callback: (entries: PlannerEntry[]) => void): () => void {
    return onSnapshot(query(collection(db, 'planner')), snapshot => {
      const entries: PlannerEntry[] = [];
      snapshot.forEach(d => entries.push(fromFirestore(d.id, d.data())));
      callback(entries);
    });
  }

  async add(data: Omit<PlannerEntry, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'planner'), data);
    return ref.id;
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'planner', id));
  }
}
```

- [ ] **Step 3: Create FirestoreProgramsRepository**

Create `src/infrastructure/firestore/FirestoreProgramsRepository.ts`:

```typescript
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, getDoc,
} from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { Program } from '@/shared/domain/types';
import type { ProgramsRepository } from '@/services/ProgramsRepository';
import { timestampToISO } from './converters';

function fromFirestore(id: string, data: Record<string, unknown>): Program {
  return {
    id,
    name: data['name'] as string,
    description: data['description'] as string,
    creator: data['creator'] as string,
    link: data['link'] as string,
    recipeIds: (data['recipeIds'] as string[]) ?? [],
    createdAt: timestampToISO(data['createdAt'] as never),
    image: data['image'] as string | undefined,
    pdfUrl: data['pdfUrl'] as string | undefined,
    subfolders: data['subfolders'] as Program['subfolders'],
    resources: data['resources'] as Program['resources'],
    targetCalories: data['targetCalories'] as number | undefined,
    targetProteins: data['targetProteins'] as number | undefined,
    targetFats: data['targetFats'] as number | undefined,
    targetCarbs: data['targetCarbs'] as number | undefined,
    allowedProducts: data['allowedProducts'] as string[] | undefined,
    forbiddenProducts: data['forbiddenProducts'] as string[] | undefined,
  };
}

export class FirestoreProgramsRepository implements ProgramsRepository {
  subscribeAll(callback: (programs: Program[]) => void): () => void {
    return onSnapshot(query(collection(db, 'programs')), snapshot => {
      const programs: Program[] = [];
      snapshot.forEach(d => programs.push(fromFirestore(d.id, d.data())));
      callback(programs);
    });
  }

  async add(data: Omit<Program, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'programs'), data);
    return ref.id;
  }

  async update(id: string, data: Partial<Omit<Program, 'id'>>): Promise<void> {
    await updateDoc(doc(db, 'programs', id), data as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'programs', id));
  }

  async getById(id: string): Promise<Program | null> {
    const snap = await getDoc(doc(db, 'programs', id));
    if (!snap.exists()) return null;
    return fromFirestore(snap.id, snap.data());
  }
}
```

- [ ] **Step 4: Create FirestoreCartRepository**

Create `src/infrastructure/firestore/FirestoreCartRepository.ts`:

```typescript
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query,
} from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { CartItem } from '@/shared/domain/types';
import type { CartRepository } from '@/services/CartRepository';
import { timestampToISO } from './converters';

function fromFirestore(id: string, data: Record<string, unknown>): CartItem {
  return {
    id,
    name: data['name'] as string,
    amount: data['amount'] as string,
    sourceDishes: (data['sourceDishes'] as string[]) ?? [],
    checked: data['checked'] as boolean,
    isBasic: data['isBasic'] as boolean | undefined,
    createdAt: timestampToISO(data['createdAt'] as never),
  };
}

export class FirestoreCartRepository implements CartRepository {
  private snapshot: CartItem[] = [];

  subscribeAll(callback: (items: CartItem[]) => void): () => void {
    return onSnapshot(query(collection(db, 'cart')), snap => {
      const items: CartItem[] = [];
      snap.forEach(d => items.push(fromFirestore(d.id, d.data())));
      this.snapshot = items.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      callback(this.snapshot);
    });
  }

  async add(data: Omit<CartItem, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'cart'), data);
    return ref.id;
  }

  async update(id: string, data: Partial<Omit<CartItem, 'id'>>): Promise<void> {
    await updateDoc(doc(db, 'cart', id), data as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'cart', id));
  }

  async deleteAll(): Promise<void> {
    await Promise.all(this.snapshot.map(item => deleteDoc(doc(db, 'cart', item.id))));
  }
}
```

- [ ] **Step 5: Create FirestoreUserProfileRepository**

Create `src/infrastructure/firestore/FirestoreUserProfileRepository.ts`:

```typescript
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/infrastructure/firebaseApp';
import type { UserProfile } from '@/shared/domain/types';
import type { UserProfileRepository } from '@/services/UserProfileRepository';

export class FirestoreUserProfileRepository implements UserProfileRepository {
  subscribe(callback: (profile: UserProfile | null) => void): () => void {
    return onSnapshot(doc(db, 'settings', 'profile'), snap => {
      callback(snap.exists() ? (snap.data() as UserProfile) : null);
    });
  }

  async save(profile: UserProfile): Promise<void> {
    await setDoc(doc(db, 'settings', 'profile'), profile);
  }
}
```

- [ ] **Step 6: Run lint to verify all implementations compile**

```bash
npm run lint
```

Expected: 0 TypeScript errors.

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: all tests pass (unchanged count — Firestore implementations have no unit tests).

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure/firestore/FirestoreRecipesRepository.ts \
        src/infrastructure/firestore/FirestorePlannerRepository.ts \
        src/infrastructure/firestore/FirestoreProgramsRepository.ts \
        src/infrastructure/firestore/FirestoreCartRepository.ts \
        src/infrastructure/firestore/FirestoreUserProfileRepository.ts
git commit -m "feat(infra): add Firestore repository implementations"
```

---

## Task 10: Update vitest coverage config

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Update coverage `include`**

In `vitest.config.ts`, replace the `coverage.include` array:

```typescript
// Before:
include: ['src/shared/domain/**', 'src/features/cart/services/**'],

// After:
include: [
  'src/shared/domain/**',
  'src/features/cart/services/**',
  'src/infrastructure/firestore/converters.ts',
  'src/infrastructure/testing/**',
  'src/infrastructure/LocalStorageNutritionPlanRepository.ts',
],
```

- [ ] **Step 2: Run coverage to verify 100% on new files**

```bash
npm run test:coverage 2>&1 | tail -30
```

Expected: 100% coverage on all files listed in `include`. The Firestore implementations are intentionally excluded (no unit tests possible without Firebase).

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "test: expand vitest coverage config for Phase 1b files"
```

---

## Task 11: Final check

- [ ] **Step 1: Verify BASIC_KEYWORDS is gone from App.tsx**

```bash
grep -c "BASIC_KEYWORDS" src/App.tsx
```

Expected: `0`.

- [ ] **Step 2: Verify repository interface files exist**

```bash
ls src/services/
```

Expected: `CartRepository.ts  NutritionPlanRepository.ts  PlannerRepository.ts  ProgramsRepository.ts  RecipesRepository.ts  UserProfileRepository.ts`

- [ ] **Step 3: Full lint + test run**

```bash
npm run lint && npm test
```

Expected: 0 errors, all tests pass (32 from Phase 1a + 4 converter + 9 recipes + 4 planner + 7 programs + 7 cart + 4 user profile + 3 fake nutrition + 4 localStorage nutrition = **74 tests**).

- [ ] **Step 4: Verify test count is ≥ 74**

```bash
npm test -- --reporter=verbose 2>&1 | tail -5
```

Expected: output includes `74 passed` or more.
