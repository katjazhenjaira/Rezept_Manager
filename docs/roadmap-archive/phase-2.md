# Phase 2 — Firebase Auth + Security Rules

**Статус:** завершено (2026-07-19) — rules задеплоены, security-review пройден

## Чеклист

- [x] `src/infrastructure/firebaseAuth.ts` — `getAuth(app)` singleton
- [x] `src/features/auth/AuthContext.ts`, `AuthProvider.tsx`, `useAuth.ts`
- [x] `src/features/auth/LandingPage.tsx` — маркетинговый экран для гостей
- [x] `src/features/auth/LoginScreen.tsx`, `SignupScreen.tsx` — email/password
- [x] `AuthProvider` оборачивает `RepositoryProvider` в `main.tsx`; `RepositoryProvider` принимает `uid: string`
- [x] Обновить все `Firestore*.ts` (6 файлов): uid в конструкторе, `where('userId', '==', uid)` в reads, `userId` в writes
- [x] `userId?: string` в типах `Recipe`, `PlannerEntry`, `CartItem`, `Program`, `UserProfile`
- [x] Кнопка «Выйти» в `SettingsModal` → `signOut(auth)`
- [x] `firestore.rules` — `request.auth.uid == resource.data.userId`
- [x] Миграционный скрипт: `scripts/migrate-assign-user.ts`
- [x] Тесты: `AuthProvider.test.tsx`, `LoginScreen.test.tsx`, `SignupScreen.test.tsx`, `FakeAuthProvider.tsx` — 112 тестов
- [x] Повторный security-review — найдена и исправлена уязвимость userId-overwrite
- [ ] **Google OAuth** (`signInWithPopup` + `GoogleAuthProvider`) — Phase 2b, следующий шаг

## Критерий готовности (DoD) — выполнен

- Firebase Rules Playground: неаутентифицированное чтение `recipes` → denied ✅
- Новый пользователь видит пустое приложение ✅
- После logout → LandingPage, все подписки закрыты ✅
- Миграционный скрипт: все документы получили `userId` ✅
- `npm run lint` и `npm test` зелёные ✅

## Ключевые решения

- AuthProvider рендерит children во время loading (loading:true в контексте); `AuthenticatedApp` guard `if (loading || !user) return null`
- HIGH-уязвимость: `update` не проверял иммутабельность `userId` → data poisoning. Исправлено: `request.resource.data.userId == resource.data.userId` для всех 4 коллекций (commit `aecde4a`)
- Firebase-проект сменён с `mein-app-25e08` (партнёрский) на `rezept-manager-62bd0` (личный аккаунт videnejev@gmail.com)
- Spec: `docs/superpowers/specs/2026-07-19-phase2-firebase-auth-design.md`
