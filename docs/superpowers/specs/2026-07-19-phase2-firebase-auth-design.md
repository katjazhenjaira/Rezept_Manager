# Phase 2 — Firebase Auth + Security Rules: Design Spec

**Дата:** 2026-07-19  
**Статус:** Утверждён

---

## Контекст

Phase 1 завершена: монолитный `App.tsx` разобран на feature-модули, Repository pattern внедрён, все Firestore-репозитории работают через интерфейсы. Сейчас данные хранятся без `userId` — любой, кто знает `projectId`, может читать чужие рецепты. Phase 2 закрывает эту дыру.

**Scope Phase 2:**

- Email/password аутентификация (Google OAuth — в следующем шаге, добавлен в ROADMAP)
- Landing-страница для гостей
- Security Rules: `auth.uid == resource.data.userId`
- Миграционный скрипт: проставить `userId` всем существующим документам (один пользователь)
- Публичные программы (share-link без логина) — отложено на более поздний этап

---

## Архитектура

### Подход: AuthProvider поверх RepositoryProvider

`AuthProvider` — единственный провайдер вне auth-guard. Все остальные провайдеры монтируются только при авторизованном пользователе. Репозитории никогда не создаются с `uid = null`.

### Дерево провайдеров в `main.tsx` (после Phase 2)

```
AuthProvider
  └─ (loading)   → <LoadingSpinner />
  └─ (no user)   → <LandingPage onGoToLogin onGoToSignup />
                   <LoginScreen onGoToSignup onBack />      ← по кнопке «Войти»
                   <SignupScreen onGoToLogin onBack />      ← по кнопке «Зарегистрироваться»
  └─ (user)      → I18nProvider
                     └─ RepositoryProvider uid={user.uid}
                          └─ DataProvider
                               └─ UserProfileProvider
                                    └─ Shell → App
```

### Новые файлы

```
src/
  infrastructure/
    firebaseAuth.ts                    # getAuth(app) — singleton
  features/
    auth/
      AuthContext.ts                   # { user: FirebaseUser | null, loading: boolean }
      AuthProvider.tsx                 # onAuthStateChanged → 3 состояния
      useAuth.ts                       # хук-обёртка
      LandingPage.tsx                  # маркетинговый экран для гостей
      LoginScreen.tsx                  # форма email/password
      SignupScreen.tsx                 # форма email/password + подтверждение
      __tests__/
        AuthProvider.test.tsx
        LoginScreen.test.tsx
        SignupScreen.test.tsx
  infrastructure/
    testing/
      FakeAuthProvider.tsx             # для юнит-тестов провайдеров
scripts/
  migrate-assign-user.ts               # Node-скрипт (Firebase Admin SDK)
firestore.rules                        # Security Rules
```

### Изменяемые файлы

| Файл                                           | Что меняется                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/infrastructure/firebaseApp.ts`            | добавить `export const auth = getAuth(app)`                                                    |
| `src/app/providers/RepositoryProvider.tsx`     | принимает `uid: string` как prop                                                               |
| `src/infrastructure/firestore/*.ts` (6 файлов) | конструктор принимает `uid`, adds `where('userId', '==', uid)` в reads, `userId: uid` в writes |
| `src/shared/domain/types.ts`                   | `userId?: string` в `Recipe`, `PlannerEntry`, `CartItem`, `Program`, `UserProfile`             |
| `src/features/settings/SettingsModal.tsx`      | кнопка «Выйти» → `signOut(auth)`                                                               |
| `src/main.tsx`                                 | обернуть в `AuthProvider`, передать `uid` в `RepositoryProvider`                               |

---

## AuthProvider

```typescript
type AuthScreen = 'landing' | 'login' | 'signup';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<AuthScreen>('landing');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) setScreen('landing'); // сброс экрана при логине
    });
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!user) {
    if (screen === 'login') return <LoginScreen onGoToSignup={() => setScreen('signup')} onBack={() => setScreen('landing')} />;
    if (screen === 'signup') return <SignupScreen onGoToLogin={() => setScreen('login')} onBack={() => setScreen('landing')} />;
    return <LandingPage onGoToLogin={() => setScreen('login')} onGoToSignup={() => setScreen('signup')} />;
  }

  return (
    <AuthContext.Provider value={{ user, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## LandingPage

Минималистичная страница:

- Название приложения + описание 2–3 строки (на русском)
- Кнопки «Войти» и «Зарегистрироваться»
- Props: `onGoToLogin: () => void`, `onGoToSignup: () => void`

---

## LoginScreen

- Поля: email, password
- Submit → `signInWithEmailAndPassword(auth, email, password)`
- Ошибки Firebase маппятся на русские сообщения:
  - `auth/user-not-found` → «Пользователь не найден»
  - `auth/wrong-password` → «Неверный пароль»
  - `auth/invalid-email` → «Некорректный email»
  - `auth/too-many-requests` → «Слишком много попыток, попробуйте позже»
- Кнопка «Войти» заблокирована (`disabled`) во время запроса
- Ссылка «Нет аккаунта? Зарегистрироваться» → `onGoToSignup()`
- Props: `onGoToSignup: () => void`, `onBack: () => void`

---

## SignupScreen

- Поля: email, password, подтверждение пароля
- Клиентская валидация перед отправкой:
  - пароли совпадают
  - минимум 6 символов
- Submit → `createUserWithEmailAndPassword(auth, email, password)`
- После успеха: `onAuthStateChanged` автоматически переключает AuthProvider в авторизованный режим
- Ссылка «Уже есть аккаунт? Войти» → `onGoToLogin()`
- Props: `onGoToLogin: () => void`, `onBack: () => void`

---

## Изменения репозиториев

### RepositoryProvider

```typescript
export function RepositoryProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const repositories = useMemo<Repositories>(
    () => ({
      recipes: new FirestoreRecipesRepository(uid),
      planner: new FirestorePlannerRepository(uid),
      cart: new FirestoreCartRepository(uid),
      programs: new FirestoreProgramsRepository(uid),
      userProfile: new FirestoreUserProfileRepository(uid),
      nutritionPlan: new FirestoreNutritionPlanRepository(uid),
    }),
    [uid],
  );
  // ...
}
```

### Паттерн для каждого Firestore-репозитория

```typescript
export class FirestoreRecipesRepository implements RecipesRepository {
  constructor(private readonly uid: string) {}

  subscribeAll(callback: (items: Recipe[]) => void): () => void {
    return onSnapshot(
      query(collection(db, 'recipes'), where('userId', '==', this.uid)),
      (snapshot) => {
        /* ... */
      },
    );
  }

  async add(data: Omit<Recipe, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'recipes'), { ...data, userId: this.uid });
    return ref.id;
  }
  // update и delete не меняются — Security Rules защитят на уровне Firebase
}
```

### Типы

`userId?: string` добавляется в интерфейсы `Recipe`, `PlannerEntry`, `CartItem`, `Program`, `UserProfile` — опциональное, чтобы не ломать FakeRepositories до и после миграции.

---

## Выход из приложения

Кнопка «Выйти» в `SettingsModal`:

```typescript
import { signOut } from 'firebase/auth';
import { auth } from '@/infrastructure/firebaseAuth';

await signOut(auth);
// AuthProvider ловит onAuthStateChanged(null) → показывает LandingPage
// DataProvider и UserProfileProvider размонтируются → все подписки Firestore очищаются
```

---

## Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{collection}/{docId} {
      allow read, update, delete: if request.auth != null
                                  && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
                    && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

---

## Миграционный скрипт

**Файл:** `scripts/migrate-assign-user.ts`  
**Runtime:** Node.js + `ts-node` (или `tsx`)  
**SDK:** Firebase Admin SDK (`firebase-admin`)

### Алгоритм

1. Инициализировать Admin SDK через `GOOGLE_APPLICATION_CREDENTIALS` (JSON-файл сервисного аккаунта)
2. Взять `TARGET_UID` из env-переменной `MIGRATION_USER_UID`
3. Для каждой коллекции (`recipes`, `plannerEntries`, `cartItems`, `programs`, `settings`):
   - `getDocs(collection(db, name))`
   - Для документов без поля `userId` — `update(ref, { userId: TARGET_UID })`
4. Вывести счётчик: `Updated 42/42 recipes, 15/15 plannerEntries, ...`

### Запуск

```bash
MIGRATION_USER_UID=<uid> npx tsx scripts/migrate-assign-user.ts
```

---

## Тестирование

### AuthProvider (4 теста)

- `loading=true` → рендерит спиннер, не рендерит children
- `user=null` → рендерит `LandingPage`
- `user=FirebaseUser` → рендерит children
- logout → возвращается `LandingPage`

Firebase Auth мокается через `vi.mock('firebase/auth')`.

### LoginScreen (3 теста)

- успешный вход → `signInWithEmailAndPassword` вызван с правильными аргументами
- `auth/wrong-password` → отображает сообщение «Неверный пароль»
- кнопка заблокирована во время запроса

### SignupScreen (4 теста)

- успешная регистрация → `createUserWithEmailAndPassword` вызван
- несовпадающие пароли → ошибка без вызова Firebase
- пароль < 6 символов → ошибка без вызова Firebase
- `auth/email-already-in-use` → человекочитаемое сообщение

### FakeAuthProvider

`src/infrastructure/testing/FakeAuthProvider.tsx` — синхронный провайдер для существующих тестов провайдеров:

```typescript
function FakeAuthProvider({ uid, children }: { uid: string | null; children: ReactNode }) {
  // устанавливает AuthContext немедленно, без onAuthStateChanged
}
```

### Существующие тесты

101 существующий тест не затрагивается — они используют `FakeRepositories` и не зависят от Auth.

---

## Критерии готовности (DoD)

- Firebase Rules Playground: неаутентифицированное чтение `recipes` → denied
- Новый пользователь после регистрации видит пустое приложение (не чужие данные)
- После logout → LandingPage, все Firestore-подписки закрыты
- Миграционный скрипт: `Updated N recipes, M plannerEntries, ...` без ошибок
- `npm run lint` и `npm test` — зелёные
- Повторный security-review (skill)

---

## Следующий шаг (не в Phase 2)

- Google OAuth (`signInWithPopup` + `GoogleAuthProvider`) — добавить в ROADMAP как Phase 2b или начало Phase 3
