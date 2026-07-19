# Phase 2 — Firebase Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить Firebase Auth (email/password) + Security Rules, чтобы каждый пользователь видел только свои данные.

**Architecture:** `AuthProvider` оборачивает `RepositoryProvider` — репозитории создаются только при авторизованном пользователе и всегда получают `uid`. Четыре коллекции (recipes/planner/cart/programs) используют `where('userId', '==', uid)` + `userId` в writes. UserProfile и NutritionPlan используют user-specific doc paths (`userProfiles/{uid}`, `nutritionPlans/{uid}`).

**Tech Stack:** Firebase 12 (`firebase/auth` — `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `onAuthStateChanged`, `signOut`), React 19, Vitest + @testing-library/react + @testing-library/jest-dom.

**Spec:** `docs/superpowers/specs/2026-07-19-phase2-firebase-auth-design.md`

---

## Файловая карта

| Статус | Путь | Что делает |
|--------|------|-----------|
| NEW | `src/infrastructure/firebaseAuth.ts` | `getAuth(app)` singleton, экспортирует `auth` |
| NEW | `src/features/auth/AuthContext.ts` | `{ user: FirebaseUser \| null, loading: boolean }` |
| NEW | `src/features/auth/useAuth.ts` | хук-обёртка над AuthContext |
| NEW | `src/features/auth/AuthProvider.tsx` | 3 состояния: loading / no-user / user |
| NEW | `src/features/auth/LandingPage.tsx` | маркетинговый экран для гостей |
| NEW | `src/features/auth/LoginScreen.tsx` | форма email/password + error map |
| NEW | `src/features/auth/SignupScreen.tsx` | форма email/password/confirm + валидация |
| NEW | `src/features/auth/__tests__/AuthProvider.test.tsx` | 4 теста AuthProvider |
| NEW | `src/features/auth/__tests__/LoginScreen.test.tsx` | 3 теста LoginScreen |
| NEW | `src/features/auth/__tests__/SignupScreen.test.tsx` | 4 теста SignupScreen |
| NEW | `src/infrastructure/testing/FakeAuthProvider.tsx` | синхронный провайдер для тестов |
| NEW | `firestore.rules` | Security Rules |
| NEW | `scripts/migrate-assign-user.ts` | Admin SDK — проставить userId всем docs |
| MODIFY | `src/infrastructure/firebaseApp.ts` | добавить `export const auth` |
| MODIFY | `src/shared/domain/types.ts` | `userId?: string` в Recipe, PlannerEntry, CartItem, Program |
| MODIFY | `src/app/providers/RepositoryProvider.tsx` | принимает `uid: string` prop |
| MODIFY | `src/infrastructure/firestore/FirestoreRecipesRepository.ts` | uid + where + userId в writes |
| MODIFY | `src/infrastructure/firestore/FirestorePlannerRepository.ts` | uid + where + userId в writes |
| MODIFY | `src/infrastructure/firestore/FirestoreCartRepository.ts` | uid + where + userId в writes |
| MODIFY | `src/infrastructure/firestore/FirestoreProgramsRepository.ts` | uid + where + userId в writes |
| MODIFY | `src/infrastructure/firestore/FirestoreUserProfileRepository.ts` | path → `userProfiles/{uid}` |
| MODIFY | `src/infrastructure/firestore/FirestoreNutritionPlanRepository.ts` | path → `nutritionPlans/{uid}` |
| MODIFY | `src/main.tsx` | AuthProvider снаружи, uid → RepositoryProvider |
| MODIFY | `src/features/settings/SettingsModal.tsx` | кнопка «Выйти» |
| MODIFY | `vitest.config.ts` | добавить `setupFiles` для jest-dom |

---

## Task 1: Auth singleton + vitest setup

**Files:**
- Create: `src/infrastructure/firebaseAuth.ts`
- Modify: `src/infrastructure/firebaseApp.ts`
- Modify: `vitest.config.ts`
- Create: `src/test-setup.ts`

- [ ] **Step 1: Добавить `auth` в firebaseApp.ts**

  В `src/infrastructure/firebaseApp.ts` добавить импорт и экспорт:
  ```typescript
  // после строки import { getFirestore }...
  import { getAuth } from 'firebase/auth';
  
  // после export const db = getFirestore(app);
  export const auth = getAuth(app);
  ```

- [ ] **Step 2: Создать `src/infrastructure/firebaseAuth.ts`**

  ```typescript
  export { auth } from '@/infrastructure/firebaseApp';
  ```

  Это алиас для удобного импорта в auth-компонентах без длинного пути.

- [ ] **Step 3: Настроить jest-dom в vitest.config.ts**

  В `vitest.config.ts` добавить `setupFiles`:
  ```typescript
  export default defineConfig({
    test: {
      environment: 'node',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
      exclude: ['**/node_modules/**', '**/.worktrees/**'],
      // ... остальное без изменений
    },
    // ...
  });
  ```

- [ ] **Step 4: Создать `src/test-setup.ts`**

  ```typescript
  import '@testing-library/jest-dom';
  ```

- [ ] **Step 5: Проверить, что существующие тесты не сломались**

  ```bash
  npm test
  ```

  Ожидаемый результат: все 101 тест зелёный.

- [ ] **Step 6: Commit**

  ```bash
  git add src/infrastructure/firebaseApp.ts src/infrastructure/firebaseAuth.ts vitest.config.ts src/test-setup.ts
  git commit -m "feat(auth): add Firebase auth singleton and jest-dom test setup"
  ```

---

## Task 2: Добавить `userId?` в domain types

**Files:**
- Modify: `src/shared/domain/types.ts`

- [ ] **Step 1: Добавить `userId?: string` в четыре типа**

  В `src/shared/domain/types.ts` добавить поле после `id` в каждый из интерфейсов:

  ```typescript
  export interface Recipe {
    id: string;
    userId?: string;   // ← добавить
    title: string;
    // ... остальные поля без изменений
  }
  
  export type Program = {
    id: string;
    userId?: string;   // ← добавить
    name: string;
    // ... остальные поля без изменений
  };
  
  export type PlannerEntry = {
    id: string;
    userId?: string;   // ← добавить
    date: string;
    // ... остальные поля без изменений
  };
  
  export interface CartItem {
    id: string;
    userId?: string;   // ← добавить
    name: string;
    // ... остальные поля без изменений
  }
  ```

  `UserProfile` не получает `userId` — она хранится по uid-пути, не требует поля.

- [ ] **Step 2: Проверить lint**

  ```bash
  npm run lint
  ```

  Ожидаемый результат: 0 ошибок (поле опциональное, не ломает существующий код).

- [ ] **Step 3: Commit**

  ```bash
  git add src/shared/domain/types.ts
  git commit -m "feat(auth): add optional userId field to domain types"
  ```

---

## Task 3: AuthContext + useAuth hook

**Files:**
- Create: `src/features/auth/AuthContext.ts`
- Create: `src/features/auth/useAuth.ts`

- [ ] **Step 1: Создать `src/features/auth/AuthContext.ts`**

  ```typescript
  import { createContext, useContext } from 'react';
  import type { User as FirebaseUser } from 'firebase/auth';
  
  export type AuthState = {
    user: FirebaseUser | null;
    loading: boolean;
  };
  
  export const AuthContext = createContext<AuthState>({
    user: null,
    loading: true,
  });
  
  export function useAuthContext(): AuthState {
    return useContext(AuthContext);
  }
  ```

- [ ] **Step 2: Создать `src/features/auth/useAuth.ts`**

  ```typescript
  import { useAuthContext } from './AuthContext';
  import type { User as FirebaseUser } from 'firebase/auth';
  
  export function useAuth(): { user: FirebaseUser; } {
    const { user, loading } = useAuthContext();
    if (loading || !user) {
      throw new Error('useAuth must be used inside AuthProvider with an authenticated user');
    }
    return { user };
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/features/auth/AuthContext.ts src/features/auth/useAuth.ts
  git commit -m "feat(auth): add AuthContext and useAuth hook"
  ```

---

## Task 4: FakeAuthProvider для тестов

**Files:**
- Create: `src/infrastructure/testing/FakeAuthProvider.tsx`

- [ ] **Step 1: Создать `src/infrastructure/testing/FakeAuthProvider.tsx`**

  ```typescript
  import type { ReactNode } from 'react';
  import type { User as FirebaseUser } from 'firebase/auth';
  import { AuthContext } from '@/features/auth/AuthContext';
  
  type Props = {
    uid: string | null;
    children: ReactNode;
  };
  
  export function FakeAuthProvider({ uid, children }: Props) {
    const user = uid
      ? ({ uid, email: 'test@test.com' } as unknown as FirebaseUser)
      : null;
  
    return (
      <AuthContext.Provider value={{ user, loading: false }}>
        {children}
      </AuthContext.Provider>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/infrastructure/testing/FakeAuthProvider.tsx
  git commit -m "feat(auth): add FakeAuthProvider for unit tests"
  ```

---

## Task 5: LandingPage

**Files:**
- Create: `src/features/auth/LandingPage.tsx`

- [ ] **Step 1: Создать `src/features/auth/LandingPage.tsx`**

  ```typescript
  type Props = {
    onGoToLogin: () => void;
    onGoToSignup: () => void;
  };
  
  export function LandingPage({ onGoToLogin, onGoToSignup }: Props) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Rezept Manager</h1>
            <p className="text-gray-600 text-sm leading-relaxed">
              Умная кулинарная книга с планером питания и AI-диетологом.
              Считайте КБЖУ, планируйте меню и получайте персональные рекомендации.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={onGoToLogin}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Войти
            </button>
            <button
              onClick={onGoToSignup}
              className="w-full bg-white text-blue-600 border border-blue-600 py-3 rounded-xl font-medium hover:bg-blue-50 transition-colors"
            >
              Зарегистрироваться
            </button>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/features/auth/LandingPage.tsx
  git commit -m "feat(auth): add LandingPage for unauthenticated users"
  ```

---

## Task 6: LoginScreen (TDD)

**Files:**
- Create: `src/features/auth/__tests__/LoginScreen.test.tsx`
- Create: `src/features/auth/LoginScreen.tsx`

- [ ] **Step 1: Написать падающие тесты**

  Создать `src/features/auth/__tests__/LoginScreen.test.tsx`:

  ```typescript
  // @vitest-environment jsdom
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  import { LoginScreen } from '../LoginScreen';
  
  vi.mock('firebase/auth', () => ({
    signInWithEmailAndPassword: vi.fn(),
  }));
  vi.mock('@/infrastructure/firebaseAuth', () => ({
    auth: {},
  }));
  
  import { signInWithEmailAndPassword } from 'firebase/auth';
  
  describe('LoginScreen', () => {
    const onGoToSignup = vi.fn();
    const onBack = vi.fn();
  
    beforeEach(() => vi.clearAllMocks());
  
    it('calls signInWithEmailAndPassword with correct credentials on submit', async () => {
      vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({} as never);
      render(<LoginScreen onGoToSignup={onGoToSignup} onBack={onBack} />);
  
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  
      await waitFor(() => {
        expect(signInWithEmailAndPassword).toHaveBeenCalledWith({}, 'test@test.com', 'password123');
      });
    });
  
    it('shows Russian error message for wrong password', async () => {
      const error = Object.assign(new Error('wrong password'), { code: 'auth/wrong-password' });
      vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(error);
      render(<LoginScreen onGoToSignup={onGoToSignup} onBack={onBack} />);
  
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'wrong' } });
      fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  
      await waitFor(() => {
        expect(screen.getByText('Неверный пароль')).toBeInTheDocument();
      });
    });
  
    it('disables submit button while request is in flight', async () => {
      vi.mocked(signInWithEmailAndPassword).mockImplementation(
        () => new Promise(() => {})
      );
      render(<LoginScreen onGoToSignup={onGoToSignup} onBack={onBack} />);
  
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  
      expect(screen.getByRole('button', { name: 'Войти' })).toBeDisabled();
    });
  });
  ```

- [ ] **Step 2: Запустить тесты — убедиться в FAIL**

  ```bash
  npm test -- src/features/auth/__tests__/LoginScreen.test.tsx
  ```

  Ожидаемый результат: `FAIL` — `Cannot find module '../LoginScreen'`.

- [ ] **Step 3: Создать `src/features/auth/LoginScreen.tsx`**

  ```typescript
  import { useState } from 'react';
  import { signInWithEmailAndPassword } from 'firebase/auth';
  import { auth } from '@/infrastructure/firebaseAuth';
  
  const AUTH_ERRORS: Record<string, string> = {
    'auth/user-not-found': 'Пользователь не найден',
    'auth/wrong-password': 'Неверный пароль',
    'auth/invalid-email': 'Некорректный email',
    'auth/invalid-credential': 'Неверный email или пароль',
    'auth/too-many-requests': 'Слишком много попыток, попробуйте позже',
  };
  
  type Props = {
    onGoToSignup: () => void;
    onBack: () => void;
  };
  
  export function LoginScreen({ onGoToSignup, onBack }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: unknown) {
        const code = (err as { code?: string }).code ?? '';
        setError(AUTH_ERRORS[code] ?? 'Ошибка входа, попробуйте ещё раз');
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Войти</h1>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Войти
            </button>
          </form>
          <p className="text-center text-sm text-gray-600">
            Нет аккаунта?{' '}
            <button onClick={onGoToSignup} className="text-blue-600 hover:underline">
              Зарегистрироваться
            </button>
          </p>
          <button onClick={onBack} className="w-full text-sm text-gray-500 hover:text-gray-700">
            ← Назад
          </button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Запустить тесты — убедиться в PASS**

  ```bash
  npm test -- src/features/auth/__tests__/LoginScreen.test.tsx
  ```

  Ожидаемый результат: `3 passed`.

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/auth/__tests__/LoginScreen.test.tsx src/features/auth/LoginScreen.tsx
  git commit -m "feat(auth): add LoginScreen with email/password and error handling"
  ```

---

## Task 7: SignupScreen (TDD)

**Files:**
- Create: `src/features/auth/__tests__/SignupScreen.test.tsx`
- Create: `src/features/auth/SignupScreen.tsx`

- [ ] **Step 1: Написать падающие тесты**

  Создать `src/features/auth/__tests__/SignupScreen.test.tsx`:

  ```typescript
  // @vitest-environment jsdom
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { render, screen, fireEvent, waitFor } from '@testing-library/react';
  import { SignupScreen } from '../SignupScreen';
  
  vi.mock('firebase/auth', () => ({
    createUserWithEmailAndPassword: vi.fn(),
  }));
  vi.mock('@/infrastructure/firebaseAuth', () => ({
    auth: {},
  }));
  
  import { createUserWithEmailAndPassword } from 'firebase/auth';
  
  describe('SignupScreen', () => {
    const onGoToLogin = vi.fn();
    const onBack = vi.fn();
  
    beforeEach(() => vi.clearAllMocks());
  
    function fillForm(email: string, password: string, confirm: string) {
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
      fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: password } });
      fireEvent.change(screen.getByLabelText('Подтвердите пароль'), { target: { value: confirm } });
    }
  
    it('calls createUserWithEmailAndPassword with correct credentials', async () => {
      vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({} as never);
      render(<SignupScreen onGoToLogin={onGoToLogin} onBack={onBack} />);
  
      fillForm('new@test.com', 'secret123', 'secret123');
      fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
  
      await waitFor(() => {
        expect(createUserWithEmailAndPassword).toHaveBeenCalledWith({}, 'new@test.com', 'secret123');
      });
    });
  
    it('shows error when passwords do not match — no Firebase call', () => {
      render(<SignupScreen onGoToLogin={onGoToLogin} onBack={onBack} />);
      fillForm('a@b.com', 'pass123', 'mismatch');
      fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
  
      expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument();
      expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });
  
    it('shows error when password is shorter than 6 chars — no Firebase call', () => {
      render(<SignupScreen onGoToLogin={onGoToLogin} onBack={onBack} />);
      fillForm('a@b.com', '12', '12');
      fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
  
      expect(screen.getByText('Пароль должен содержать не менее 6 символов')).toBeInTheDocument();
      expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });
  
    it('shows Russian error for email-already-in-use', async () => {
      const error = Object.assign(new Error(), { code: 'auth/email-already-in-use' });
      vi.mocked(createUserWithEmailAndPassword).mockRejectedValueOnce(error);
      render(<SignupScreen onGoToLogin={onGoToLogin} onBack={onBack} />);
  
      fillForm('existing@test.com', 'pass123', 'pass123');
      fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
  
      await waitFor(() => {
        expect(screen.getByText('Аккаунт с таким email уже существует')).toBeInTheDocument();
      });
    });
  });
  ```

- [ ] **Step 2: Запустить тесты — убедиться в FAIL**

  ```bash
  npm test -- src/features/auth/__tests__/SignupScreen.test.tsx
  ```

  Ожидаемый результат: `FAIL` — `Cannot find module '../SignupScreen'`.

- [ ] **Step 3: Создать `src/features/auth/SignupScreen.tsx`**

  ```typescript
  import { useState } from 'react';
  import { createUserWithEmailAndPassword } from 'firebase/auth';
  import { auth } from '@/infrastructure/firebaseAuth';
  
  const AUTH_ERRORS: Record<string, string> = {
    'auth/email-already-in-use': 'Аккаунт с таким email уже существует',
    'auth/invalid-email': 'Некорректный email',
    'auth/weak-password': 'Пароль слишком простой',
  };
  
  type Props = {
    onGoToLogin: () => void;
    onBack: () => void;
  };
  
  export function SignupScreen({ onGoToLogin, onBack }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (password.length < 6) {
        setError('Пароль должен содержать не менее 6 символов');
        return;
      }
      if (password !== confirm) {
        setError('Пароли не совпадают');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (err: unknown) {
        const code = (err as { code?: string }).code ?? '';
        setError(AUTH_ERRORS[code] ?? 'Ошибка регистрации, попробуйте ещё раз');
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Регистрация</h1>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
                Подтвердите пароль
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Зарегистрироваться
            </button>
          </form>
          <p className="text-center text-sm text-gray-600">
            Уже есть аккаунт?{' '}
            <button onClick={onGoToLogin} className="text-blue-600 hover:underline">
              Войти
            </button>
          </p>
          <button onClick={onBack} className="w-full text-sm text-gray-500 hover:text-gray-700">
            ← Назад
          </button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Запустить тесты — убедиться в PASS**

  ```bash
  npm test -- src/features/auth/__tests__/SignupScreen.test.tsx
  ```

  Ожидаемый результат: `4 passed`.

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/auth/__tests__/SignupScreen.test.tsx src/features/auth/SignupScreen.tsx
  git commit -m "feat(auth): add SignupScreen with client validation and error mapping"
  ```

---

## Task 8: AuthProvider (TDD)

**Files:**
- Create: `src/features/auth/__tests__/AuthProvider.test.tsx`
- Create: `src/features/auth/AuthProvider.tsx`

- [ ] **Step 1: Написать падающие тесты**

  Создать `src/features/auth/__tests__/AuthProvider.test.tsx`:

  ```typescript
  // @vitest-environment jsdom
  import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
  import { render, screen, act } from '@testing-library/react';
  import type { User as FirebaseUser } from 'firebase/auth';
  import { AuthProvider } from '../AuthProvider';
  import { useAuthContext } from '../AuthContext';
  
  vi.mock('firebase/auth', () => ({
    onAuthStateChanged: vi.fn(),
  }));
  vi.mock('@/infrastructure/firebaseAuth', () => ({
    auth: {},
  }));
  
  import { onAuthStateChanged } from 'firebase/auth';
  
  function AuthStateDisplay() {
    const { user, loading } = useAuthContext();
    if (loading) return <div>loading</div>;
    if (!user) return <div>no-user</div>;
    return <div>user:{user.uid}</div>;
  }
  
  describe('AuthProvider', () => {
    beforeEach(() => vi.clearAllMocks());
  
    it('renders loading spinner before onAuthStateChanged fires', () => {
      (onAuthStateChanged as Mock).mockImplementation(() => () => {});
      render(<AuthProvider><AuthStateDisplay /></AuthProvider>);
      expect(screen.getByText('loading')).toBeInTheDocument();
    });
  
    it('renders LandingPage (no-user branch) when Firebase returns null', async () => {
      (onAuthStateChanged as Mock).mockImplementation((_auth: unknown, cb: (u: null) => void) => {
        cb(null);
        return () => {};
      });
      render(<AuthProvider><AuthStateDisplay /></AuthProvider>);
      // AuthProvider intercepts no-user and shows LandingPage, not children
      expect(screen.queryByText('no-user')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    });
  
    it('renders children when Firebase returns a user', async () => {
      const fakeUser = { uid: 'abc123' } as FirebaseUser;
      (onAuthStateChanged as Mock).mockImplementation((_auth: unknown, cb: (u: FirebaseUser) => void) => {
        cb(fakeUser);
        return () => {};
      });
      render(<AuthProvider><AuthStateDisplay /></AuthProvider>);
      expect(screen.getByText('user:abc123')).toBeInTheDocument();
    });
  
    it('returns to LandingPage after logout', async () => {
      let authCallback: (u: FirebaseUser | null) => void = () => {};
      (onAuthStateChanged as Mock).mockImplementation((_auth: unknown, cb: (u: FirebaseUser | null) => void) => {
        authCallback = cb;
        cb({ uid: 'abc123' } as FirebaseUser);
        return () => {};
      });
      render(<AuthProvider><AuthStateDisplay /></AuthProvider>);
      expect(screen.getByText('user:abc123')).toBeInTheDocument();
  
      act(() => authCallback(null));
      expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Запустить тесты — убедиться в FAIL**

  ```bash
  npm test -- src/features/auth/__tests__/AuthProvider.test.tsx
  ```

  Ожидаемый результат: `FAIL` — `Cannot find module '../AuthProvider'`.

- [ ] **Step 3: Создать `src/features/auth/AuthProvider.tsx`**

  ```typescript
  import { useState, useEffect, type ReactNode } from 'react';
  import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
  import { auth } from '@/infrastructure/firebaseAuth';
  import { AuthContext } from './AuthContext';
  import { LandingPage } from './LandingPage';
  import { LoginScreen } from './LoginScreen';
  import { SignupScreen } from './SignupScreen';
  
  type AuthScreen = 'landing' | 'login' | 'signup';
  
  export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [screen, setScreen] = useState<AuthScreen>('landing');
  
    useEffect(() => {
      return onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
        if (u) setScreen('landing');
      });
    }, []);
  
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
  
    if (!user) {
      if (screen === 'login') {
        return (
          <LoginScreen
            onGoToSignup={() => setScreen('signup')}
            onBack={() => setScreen('landing')}
          />
        );
      }
      if (screen === 'signup') {
        return (
          <SignupScreen
            onGoToLogin={() => setScreen('login')}
            onBack={() => setScreen('landing')}
          />
        );
      }
      return (
        <LandingPage
          onGoToLogin={() => setScreen('login')}
          onGoToSignup={() => setScreen('signup')}
        />
      );
    }
  
    return (
      <AuthContext.Provider value={{ user, loading: false }}>
        {children}
      </AuthContext.Provider>
    );
  }
  ```

- [ ] **Step 4: Запустить тесты — убедиться в PASS**

  ```bash
  npm test -- src/features/auth/__tests__/AuthProvider.test.tsx
  ```

  Ожидаемый результат: `4 passed`.

- [ ] **Step 5: Запустить все тесты — убедиться, что ничего не сломалось**

  ```bash
  npm test
  ```

  Ожидаемый результат: все тесты зелёные (было 101 + новые 11).

- [ ] **Step 6: Commit**

  ```bash
  git add src/features/auth/__tests__/AuthProvider.test.tsx src/features/auth/AuthProvider.tsx
  git commit -m "feat(auth): add AuthProvider with loading/unauthenticated/authenticated states"
  ```

---

## Task 9: RepositoryProvider принимает uid

**Files:**
- Modify: `src/app/providers/RepositoryProvider.tsx`

- [ ] **Step 1: Обновить RepositoryProvider**

  Заменить весь файл `src/app/providers/RepositoryProvider.tsx`:

  ```typescript
  import { useMemo, type ReactNode } from 'react';
  import { FirestoreRecipesRepository } from '@/infrastructure/firestore/FirestoreRecipesRepository';
  import { FirestorePlannerRepository } from '@/infrastructure/firestore/FirestorePlannerRepository';
  import { FirestoreCartRepository } from '@/infrastructure/firestore/FirestoreCartRepository';
  import { FirestoreProgramsRepository } from '@/infrastructure/firestore/FirestoreProgramsRepository';
  import { FirestoreUserProfileRepository } from '@/infrastructure/firestore/FirestoreUserProfileRepository';
  import { FirestoreNutritionPlanRepository } from '@/infrastructure/firestore/FirestoreNutritionPlanRepository';
  import { RepositoryContext, type Repositories } from './RepositoryContext';
  
  type Props = {
    uid: string;
    children: ReactNode;
  };
  
  export function RepositoryProvider({ uid, children }: Props) {
    const repositories = useMemo<Repositories>(() => ({
      recipes: new FirestoreRecipesRepository(uid),
      planner: new FirestorePlannerRepository(uid),
      cart: new FirestoreCartRepository(uid),
      programs: new FirestoreProgramsRepository(uid),
      userProfile: new FirestoreUserProfileRepository(uid),
      nutritionPlan: new FirestoreNutritionPlanRepository(uid),
    }), [uid]);
  
    return (
      <RepositoryContext.Provider value={repositories}>
        {children}
      </RepositoryContext.Provider>
    );
  }
  ```

- [ ] **Step 2: Проверить lint**

  ```bash
  npm run lint
  ```

  Ожидаемый результат: TypeScript-ошибка о том, что `main.tsx` передаёт `RepositoryProvider` без `uid` — это ожидаемо, исправим в Task 15.

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/providers/RepositoryProvider.tsx
  git commit -m "feat(auth): RepositoryProvider accepts uid prop for user-scoped repositories"
  ```

---

## Task 10: FirestoreRecipesRepository — uid scope

**Files:**
- Modify: `src/infrastructure/firestore/FirestoreRecipesRepository.ts`

- [ ] **Step 1: Обновить FirestoreRecipesRepository**

  Заменить весь файл `src/infrastructure/firestore/FirestoreRecipesRepository.ts`:

  ```typescript
  import {
    collection, addDoc, updateDoc, deleteDoc, doc,
    onSnapshot, query, getDoc, where,
  } from 'firebase/firestore';
  import { db } from '@/infrastructure/firebaseApp';
  import type { Recipe } from '@/shared/domain/types';
  import type { RecipesRepository } from '@/services/RecipesRepository';
  import { timestampToISO, type TimestampLike } from './converters';
  
  function fromFirestore(id: string, data: Record<string, unknown>): Recipe {
    return {
      id,
      title: data['title'] as string,
      image: data['image'] as string | undefined,
      sourceUrl: data['sourceUrl'] as string | undefined,
      author: data['author'] as string | undefined,
      time: data['time'] as string,
      servings: data['servings'] as number,
      categories: (data['categories'] as string[]) ?? [],
      ingredients: (data['ingredients'] as string[]) ?? [],
      steps: (data['steps'] as string[]) ?? [],
      macros: data['macros'] as Recipe['macros'],
      substitutions: data['substitutions'] as string | undefined,
      isFavorite: data['isFavorite'] as boolean | undefined,
      createdAt: timestampToISO(data['createdAt'] as TimestampLike | string | null | undefined),
    };
  }
  
  export class FirestoreRecipesRepository implements RecipesRepository {
    constructor(private readonly uid: string) {}
  
    subscribeAll(callback: (recipes: Recipe[]) => void): () => void {
      return onSnapshot(
        query(collection(db, 'recipes'), where('userId', '==', this.uid)),
        snapshot => {
          const recipes: Recipe[] = [];
          snapshot.forEach(d => recipes.push(fromFirestore(d.id, d.data())));
          callback(recipes);
        }
      );
    }
  
    async add(data: Omit<Recipe, 'id'>): Promise<string> {
      const ref = await addDoc(collection(db, 'recipes'), { ...data, userId: this.uid });
      return ref.id;
    }
  
    async update(id: string, data: Partial<Omit<Recipe, 'id'>>): Promise<void> {
      await updateDoc(doc(db, 'recipes', id), data);
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

- [ ] **Step 2: Commit**

  ```bash
  git add src/infrastructure/firestore/FirestoreRecipesRepository.ts
  git commit -m "feat(auth): scope RecipesRepository queries to current user"
  ```

---

## Task 11: FirestorePlannerRepository — uid scope

**Files:**
- Modify: `src/infrastructure/firestore/FirestorePlannerRepository.ts`

- [ ] **Step 1: Обновить FirestorePlannerRepository**

  Заменить весь файл `src/infrastructure/firestore/FirestorePlannerRepository.ts`:

  ```typescript
  import {
    collection, addDoc, deleteDoc, doc,
    onSnapshot, query, where,
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
    constructor(private readonly uid: string) {}
  
    subscribeAll(callback: (entries: PlannerEntry[]) => void): () => void {
      return onSnapshot(
        query(collection(db, 'planner'), where('userId', '==', this.uid)),
        snapshot => {
          const entries: PlannerEntry[] = [];
          snapshot.forEach(d => entries.push(fromFirestore(d.id, d.data())));
          callback(entries);
        }
      );
    }
  
    async add(data: Omit<PlannerEntry, 'id'>): Promise<string> {
      const ref = await addDoc(collection(db, 'planner'), { ...data, userId: this.uid });
      return ref.id;
    }
  
    async delete(id: string): Promise<void> {
      await deleteDoc(doc(db, 'planner', id));
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/infrastructure/firestore/FirestorePlannerRepository.ts
  git commit -m "feat(auth): scope PlannerRepository queries to current user"
  ```

---

## Task 12: FirestoreCartRepository — uid scope

**Files:**
- Modify: `src/infrastructure/firestore/FirestoreCartRepository.ts`

- [ ] **Step 1: Обновить FirestoreCartRepository**

  Заменить весь файл `src/infrastructure/firestore/FirestoreCartRepository.ts`:

  ```typescript
  import {
    collection, addDoc, updateDoc, deleteDoc, doc,
    onSnapshot, query, getDocs, where,
  } from 'firebase/firestore';
  import { db } from '@/infrastructure/firebaseApp';
  import type { CartItem } from '@/shared/domain/types';
  import type { CartRepository } from '@/services/CartRepository';
  import { timestampToISO, type TimestampLike } from './converters';
  
  function fromFirestore(id: string, data: Record<string, unknown>): CartItem {
    return {
      id,
      name: data['name'] as string,
      amount: data['amount'] as string,
      sourceDishes: (data['sourceDishes'] as string[]) ?? [],
      checked: data['checked'] as boolean,
      isBasic: data['isBasic'] as boolean | undefined,
      createdAt: timestampToISO(data['createdAt'] as TimestampLike | string | null | undefined),
    };
  }
  
  export class FirestoreCartRepository implements CartRepository {
    constructor(private readonly uid: string) {}
  
    subscribeAll(callback: (items: CartItem[]) => void): () => void {
      return onSnapshot(
        query(collection(db, 'cart'), where('userId', '==', this.uid)),
        snap => {
          const items: CartItem[] = [];
          snap.forEach(d => items.push(fromFirestore(d.id, d.data())));
          callback(
            items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          );
        }
      );
    }
  
    async add(data: Omit<CartItem, 'id'>): Promise<string> {
      const ref = await addDoc(collection(db, 'cart'), { ...data, userId: this.uid });
      return ref.id;
    }
  
    async update(id: string, data: Partial<Omit<CartItem, 'id'>>): Promise<void> {
      await updateDoc(doc(db, 'cart', id), data);
    }
  
    async delete(id: string): Promise<void> {
      await deleteDoc(doc(db, 'cart', id));
    }
  
    async deleteAll(): Promise<void> {
      const snap = await getDocs(query(collection(db, 'cart'), where('userId', '==', this.uid)));
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'cart', d.id))));
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/infrastructure/firestore/FirestoreCartRepository.ts
  git commit -m "feat(auth): scope CartRepository queries to current user"
  ```

---

## Task 13: FirestoreProgramsRepository — uid scope

**Files:**
- Modify: `src/infrastructure/firestore/FirestoreProgramsRepository.ts`

- [ ] **Step 1: Обновить FirestoreProgramsRepository**

  Заменить весь файл `src/infrastructure/firestore/FirestoreProgramsRepository.ts`:

  ```typescript
  import {
    collection, addDoc, updateDoc, deleteDoc, doc,
    onSnapshot, query, getDoc, where,
  } from 'firebase/firestore';
  import { db } from '@/infrastructure/firebaseApp';
  import type { Program } from '@/shared/domain/types';
  import type { ProgramsRepository } from '@/services/ProgramsRepository';
  import { timestampToISO, type TimestampLike } from './converters';
  
  function fromFirestore(id: string, data: Record<string, unknown>): Program {
    return {
      id,
      name: data['name'] as string,
      description: data['description'] as string,
      creator: data['creator'] as string,
      link: data['link'] as string,
      recipeIds: (data['recipeIds'] as string[]) ?? [],
      createdAt: timestampToISO(data['createdAt'] as TimestampLike | string | null | undefined),
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
    constructor(private readonly uid: string) {}
  
    subscribeAll(callback: (programs: Program[]) => void): () => void {
      return onSnapshot(
        query(collection(db, 'programs'), where('userId', '==', this.uid)),
        snapshot => {
          const programs: Program[] = [];
          snapshot.forEach(d => programs.push(fromFirestore(d.id, d.data())));
          callback(programs);
        }
      );
    }
  
    async add(data: Omit<Program, 'id'>): Promise<string> {
      const ref = await addDoc(collection(db, 'programs'), { ...data, userId: this.uid });
      return ref.id;
    }
  
    async update(id: string, data: Partial<Omit<Program, 'id'>>): Promise<void> {
      await updateDoc(doc(db, 'programs', id), data);
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

- [ ] **Step 2: Commit**

  ```bash
  git add src/infrastructure/firestore/FirestoreProgramsRepository.ts
  git commit -m "feat(auth): scope ProgramsRepository queries to current user"
  ```

---

## Task 14: FirestoreUserProfileRepository — user-specific path

**Files:**
- Modify: `src/infrastructure/firestore/FirestoreUserProfileRepository.ts`

Профиль хранится не в коллекции с `userId`-полем, а по uid-специфичному пути `userProfiles/{uid}`. Это чище: документ один на пользователя, Security Rules через `{uid}` в пути, не нужен `where()`.

- [ ] **Step 1: Обновить FirestoreUserProfileRepository**

  Заменить весь файл `src/infrastructure/firestore/FirestoreUserProfileRepository.ts`:

  ```typescript
  import { doc, onSnapshot, setDoc } from 'firebase/firestore';
  import { db } from '@/infrastructure/firebaseApp';
  import type { UserProfile } from '@/shared/domain/types';
  import type { UserProfileRepository } from '@/services/UserProfileRepository';
  
  export class FirestoreUserProfileRepository implements UserProfileRepository {
    constructor(private readonly uid: string) {}
  
    subscribe(callback: (profile: UserProfile | null) => void): () => void {
      return onSnapshot(doc(db, 'userProfiles', this.uid), snap => {
        callback(snap.exists() ? (snap.data() as UserProfile) : null);
      });
    }
  
    async save(profile: UserProfile): Promise<void> {
      await setDoc(doc(db, 'userProfiles', this.uid), profile);
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/infrastructure/firestore/FirestoreUserProfileRepository.ts
  git commit -m "feat(auth): move UserProfileRepository to user-specific path userProfiles/{uid}"
  ```

---

## Task 15: FirestoreNutritionPlanRepository — user-specific path

**Files:**
- Modify: `src/infrastructure/firestore/FirestoreNutritionPlanRepository.ts`

- [ ] **Step 1: Обновить FirestoreNutritionPlanRepository**

  Заменить весь файл `src/infrastructure/firestore/FirestoreNutritionPlanRepository.ts`:

  ```typescript
  import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
  import { db } from '@/infrastructure/firebaseApp';
  import type { NutritionPlanRepository } from '@/services/NutritionPlanRepository';
  import type { ActiveNutritionPlan } from '@/shared/domain/types';
  
  export class FirestoreNutritionPlanRepository implements NutritionPlanRepository {
    constructor(private readonly uid: string) {}
  
    private get ref() {
      return doc(db, 'nutritionPlans', this.uid);
    }
  
    async get(): Promise<ActiveNutritionPlan | null> {
      const snap = await getDoc(this.ref);
      if (!snap.exists()) return null;
      const data = snap.data() as Omit<
        ActiveNutritionPlan,
        'allowedProducts' | 'forbiddenProducts'
      > & {
        allowedProducts?: string[];
        forbiddenProducts?: string[];
      };
      return {
        ...data,
        allowedProducts: data.allowedProducts ?? [],
        forbiddenProducts: data.forbiddenProducts ?? [],
      };
    }
  
    async set(plan: ActiveNutritionPlan | null): Promise<void> {
      if (plan === null) {
        await deleteDoc(this.ref);
      } else {
        await setDoc(this.ref, plan);
      }
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/infrastructure/firestore/FirestoreNutritionPlanRepository.ts
  git commit -m "feat(auth): move NutritionPlanRepository to user-specific path nutritionPlans/{uid}"
  ```

---

## Task 16: Подключить AuthProvider в main.tsx

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Обновить main.tsx**

  Заменить весь файл `src/main.tsx`:

  ```typescript
  import { StrictMode } from 'react';
  import { createRoot } from 'react-dom/client';
  import App from './App.tsx';
  import './index.css';
  import { Shell } from './app/layout/Shell';
  import { I18nProvider } from './app/providers/I18nProvider';
  import { RepositoryProvider } from './app/providers/RepositoryProvider';
  import { DataProvider } from './app/providers/DataProvider';
  import { UserProfileProvider } from './app/providers/UserProfileProvider';
  import { AuthProvider } from './features/auth/AuthProvider';
  import { useAuthContext } from './features/auth/AuthContext';
  
  function AuthenticatedApp() {
    const { user } = useAuthContext();
    // user is guaranteed non-null here — AuthProvider only renders
    // AuthenticatedApp when user is set
    return (
      <I18nProvider>
        <RepositoryProvider uid={user!.uid}>
          <DataProvider>
            <UserProfileProvider>
              <Shell>
                <App />
              </Shell>
            </UserProfileProvider>
          </DataProvider>
        </RepositoryProvider>
      </I18nProvider>
    );
  }
  
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </StrictMode>,
  );
  ```

- [ ] **Step 2: Запустить lint**

  ```bash
  npm run lint
  ```

  Ожидаемый результат: 0 ошибок.

- [ ] **Step 3: Запустить все тесты**

  ```bash
  npm test
  ```

  Ожидаемый результат: все тесты зелёные.

- [ ] **Step 4: Commit**

  ```bash
  git add src/main.tsx
  git commit -m "feat(auth): wire up AuthProvider in main.tsx — app now requires authentication"
  ```

---

## Task 17: Кнопка «Выйти» в SettingsModal

**Files:**
- Modify: `src/features/settings/SettingsModal.tsx`

- [ ] **Step 1: Добавить импорты и кнопку выхода**

  В начало `src/features/settings/SettingsModal.tsx` добавить импорты:
  ```typescript
  import { signOut } from 'firebase/auth';
  import { auth } from '@/infrastructure/firebaseAuth';
  ```

  Добавить функцию-обработчик внутри компонента (после `handleSaveSettings`):
  ```typescript
  const handleSignOut = async () => {
    await signOut(auth);
    onClose();
  };
  ```

  Найти в JSX кнопку «Сохранить» (или конец формы настроек) и добавить кнопку выхода рядом. Разместить после кнопки сохранения:
  ```tsx
  <button
    type="button"
    onClick={handleSignOut}
    className="w-full mt-2 py-2 text-sm text-red-600 hover:text-red-700 hover:underline"
  >
    Выйти из аккаунта
  </button>
  ```

- [ ] **Step 2: Запустить lint**

  ```bash
  npm run lint
  ```

  Ожидаемый результат: 0 ошибок.

- [ ] **Step 3: Commit**

  ```bash
  git add src/features/settings/SettingsModal.tsx
  git commit -m "feat(auth): add sign-out button to SettingsModal"
  ```

---

## Task 18: Firestore Security Rules

**Files:**
- Create: `firestore.rules`

- [ ] **Step 1: Создать `firestore.rules` в корне проекта**

  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
  
      // Коллекции с полем userId
      match /recipes/{docId} {
        allow read, update, delete: if request.auth != null
                                    && request.auth.uid == resource.data.userId;
        allow create: if request.auth != null
                      && request.auth.uid == request.resource.data.userId;
      }
  
      match /planner/{docId} {
        allow read, update, delete: if request.auth != null
                                    && request.auth.uid == resource.data.userId;
        allow create: if request.auth != null
                      && request.auth.uid == request.resource.data.userId;
      }
  
      match /cart/{docId} {
        allow read, update, delete: if request.auth != null
                                    && request.auth.uid == resource.data.userId;
        allow create: if request.auth != null
                      && request.auth.uid == request.resource.data.userId;
      }
  
      match /programs/{docId} {
        allow read, update, delete: if request.auth != null
                                    && request.auth.uid == resource.data.userId;
        allow create: if request.auth != null
                      && request.auth.uid == request.resource.data.userId;
      }
  
      // User-specific singleton documents — uid как путь документа
      match /userProfiles/{uid} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
  
      match /nutritionPlans/{uid} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
  
      // Старые пути settings/* — deny всё (документы мигрированы)
      match /settings/{docId} {
        allow read, write: if false;
      }
    }
  }
  ```

- [ ] **Step 2: Задеплоить Rules в Firebase Console**

  Зайти в [Firebase Console](https://console.firebase.google.com) → Firestore Database → Rules → вставить содержимое файла → Publish.

  Или через Firebase CLI:
  ```bash
  npx firebase deploy --only firestore:rules
  ```

  Ожидаемый результат: Rules активны. В Rules Playground: неаутентифицированное чтение `/recipes/any-doc` → `denied`.

- [ ] **Step 3: Commit**

  ```bash
  git add firestore.rules
  git commit -m "feat(auth): add Firestore Security Rules — userId-scoped access for all collections"
  ```

---

## Task 19: Миграционный скрипт

**Files:**
- Create: `scripts/migrate-assign-user.ts`

- [ ] **Step 1: Установить firebase-admin (dev dependency)**

  ```bash
  npm install --save-dev firebase-admin tsx
  ```

- [ ] **Step 2: Создать `scripts/migrate-assign-user.ts`**

  ```typescript
  import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
  import { getFirestore } from 'firebase-admin/firestore';
  import { readFileSync } from 'fs';
  
  const serviceAccountPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
  const targetUid = process.env['MIGRATION_USER_UID'];
  
  if (!serviceAccountPath) {
    console.error('Error: GOOGLE_APPLICATION_CREDENTIALS env var is required');
    process.exit(1);
  }
  if (!targetUid) {
    console.error('Error: MIGRATION_USER_UID env var is required');
    process.exit(1);
  }
  
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8')) as ServiceAccount;
  
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();
  
  async function migrateCollection(name: string): Promise<number> {
    const snap = await db.collection(name).get();
    const docsWithoutUserId = snap.docs.filter(d => !d.data()['userId']);
    await Promise.all(docsWithoutUserId.map(d => d.ref.update({ userId: targetUid })));
    console.log(`  ${name}: ${docsWithoutUserId.length}/${snap.size} docs updated`);
    return docsWithoutUserId.length;
  }
  
  async function migrateSettingsDoc(
    fromPath: [string, string],
    toCollection: string
  ): Promise<void> {
    const [col, id] = fromPath;
    const snap = await db.collection(col).doc(id).get();
    if (!snap.exists) {
      console.log(`  ${col}/${id}: not found, skipping`);
      return;
    }
    await db.collection(toCollection).doc(targetUid!).set(snap.data()!);
    await db.collection(col).doc(id).delete();
    console.log(`  ${col}/${id} → ${toCollection}/${targetUid}: migrated`);
  }
  
  async function main() {
    console.log(`Migrating to userId=${targetUid}...\n`);
  
    console.log('Collections with userId field:');
    await migrateCollection('recipes');
    await migrateCollection('planner');
    await migrateCollection('cart');
    await migrateCollection('programs');
  
    console.log('\nSingleton settings documents:');
    await migrateSettingsDoc(['settings', 'profile'], 'userProfiles');
    await migrateSettingsDoc(['settings', 'plan'], 'nutritionPlans');
  
    console.log('\nMigration complete.');
  }
  
  main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
  ```

- [ ] **Step 3: Добавить инструкцию в README или запустить вручную**

  Запуск (один раз):
  ```bash
  GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
  MIGRATION_USER_UID=<your-firebase-uid> \
  npx tsx scripts/migrate-assign-user.ts
  ```

  Ожидаемый вывод:
  ```
  Migrating to userId=<uid>...

  Collections with userId field:
    recipes: 42/42 docs updated
    planner: 15/15 docs updated
    cart: 8/8 docs updated
    programs: 3/3 docs updated

  Singleton settings documents:
    settings/profile → userProfiles/<uid>: migrated
    settings/plan → nutritionPlans/<uid>: migrated

  Migration complete.
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add scripts/migrate-assign-user.ts package.json package-lock.json
  git commit -m "feat(auth): add migration script to assign userId to existing Firestore documents"
  ```

---

## Task 20: Финальная проверка

- [ ] **Step 1: Запустить полный тест-сьют**

  ```bash
  npm test
  ```

  Ожидаемый результат: все тесты зелёные (101 старых + 11 новых = 112+).

- [ ] **Step 2: Запустить lint**

  ```bash
  npm run lint
  ```

  Ожидаемый результат: 0 ошибок.

- [ ] **Step 3: Обновить ROADMAP.md**

  В `ROADMAP.md` отметить `[x]` все выполненные пункты Phase 2, обновить «Следующий шаг» на «Запустить миграционный скрипт, задеплоить Rules, провести повторный security-review», обновить дату.

- [ ] **Step 4: Commit документации**

  ```bash
  git add ROADMAP.md
  git commit -m "docs: update roadmap — Phase 2 implementation complete"
  ```

---

## Self-review

**Покрытие спека:**
- ✅ Firebase Auth (email/password) — Task 6, 7, 8
- ✅ Landing-страница — Task 5
- ✅ AuthProvider поверх RepositoryProvider — Task 8, 16
- ✅ uid в конструкторах репозиториев — Task 9–15
- ✅ `where('userId', '==', uid)` в reads — Task 10–13
- ✅ `userId: uid` в writes — Task 10–13
- ✅ UserProfile → `userProfiles/{uid}` — Task 14
- ✅ NutritionPlan → `nutritionPlans/{uid}` — Task 15
- ✅ Кнопка «Выйти» — Task 17
- ✅ Security Rules — Task 18
- ✅ Миграционный скрипт — Task 19
- ✅ FakeAuthProvider — Task 4
- ✅ Тесты AuthProvider (4), LoginScreen (3), SignupScreen (4) — Task 6, 7, 8

**Placeholder scan:** нет TBD, нет TODO без кода.

**Type consistency:**
- `FirebaseUser` из `firebase/auth` — используется везде через `User as FirebaseUser`
- `AuthContext` импортируется из `./AuthContext` в AuthProvider — корректно
- `RepositoryProvider` принимает `uid: string` — передаётся как `user!.uid` в main.tsx — `user` гарантированно не null в `AuthenticatedApp` (AuthProvider рендерит его только когда user задан)
