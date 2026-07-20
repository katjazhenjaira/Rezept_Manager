# Session Context Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сократить токен-стоимость старта сессии с ~4500 до ~300 токенов, создав STATUS.md-дашборд, заархивировав завершённые фазы и добавив техническую документацию проекта.

**Architecture:** STATUS.md читается при каждом старте (единственный обязательный read). ROADMAP.md обрезается до активных/будущих фаз и читается только при работе по плану. Завершённые фазы и решения уходят в `docs/roadmap-archive/`. `Technical_Project_Documentation.md` — полная техническая карта для нового члена команды или контекста вне знакомой области.

**Tech Stack:** Markdown files, git. Никакого кода — только документация.

---

### Task 1: Создать phase-0a.md

**Files:**

- Create: `docs/roadmap-archive/phase-0a.md`

- [ ] **Step 1: Создать директорию и файл**

```bash
mkdir -p docs/roadmap-archive
```

Создать `docs/roadmap-archive/phase-0a.md` с содержимым:

```markdown
# Phase 0a — Security Hygiene

**Статус:** завершено (2026-04-19)

## Чеклист

- [x] Firebase config → env (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_*`)
- [x] `src/firebase.ts` → `src/infrastructure/firebaseApp.ts`
- [x] `tsconfig.json`: alias `@/*` → `./src/*`, добавить `"strict": true`, `"noUncheckedIndexedAccess": true`
- [x] Починить ошибки, которые вскроет strict mode (23 фикса без TODO)
- [x] Удалить `better-sqlite3`, `dotenv` из `package.json`
- [x] Обновить `.env.example`

## Критерий готовности (DoD)

- `npm run build` — зелёный
- `npm run lint` (tsc --noEmit) — 0 ошибок
- `git grep -n 'AIza\|firebaseapp.com'` в `src/` — 0 совпадений

## Ключевые решения

- Firebase config вынесен в `VITE_FIREBASE_*` env; `src/firebase.ts` → `src/infrastructure/firebaseApp.ts`
- Включён TS strict + `noUncheckedIndexedAccess` — вскрыл 23 ошибки в App.tsx, все починены без TODO/any
- `getRecipeById` принимает `string | undefined`; guard-ы на `response.text` и `response.candidates?.[0]`
- Установлены `@types/react`/`@types/react-dom`; удалены неиспользуемые `better-sqlite3` и `dotenv`
- `.playwright-mcp/` добавлен в `.gitignore`
```

- [ ] **Step 2: Проверить файл**

```bash
wc -l docs/roadmap-archive/phase-0a.md
```

Ожидается: ~28 строк.

---

### Task 2: Создать phase-0b.md

**Files:**

- Create: `docs/roadmap-archive/phase-0b.md`

- [ ] **Step 1: Создать файл**

Создать `docs/roadmap-archive/phase-0b.md`:

```markdown
# Phase 0b — Gemini Proxy на Cloudflare Worker

**Статус:** завершено (2026-04-21)

## Чеклист

- [x] Подтянуть документацию через context7: Wrangler, `@google/genai`, Hono
- [x] Скаффолдинг `worker/` с `wrangler.toml`
- [x] 6 routes: `generate-image` ✅, `calculate-kbzhu` ✅, `import-from-url` ✅, `import-from-pdf` ✅, `import-from-photo` ✅, `fill-remaining` ✅
- [x] Shared contracts: `src/services/ai/contracts.ts`
- [x] Клиент: `src/services/ai/aiClient.ts`
- [x] Rate limiting (token bucket в Cloudflare KV, 10 req/min)
- [x] Переписать 6 вызовов `new GoogleGenAI()` в `App.tsx` на `aiClient.*` — все 6 удалены
- [x] Vite dev: `wrangler dev` на :8787, Vite proxy `/api → :8787`
- [x] Убрать `define: { 'process.env.GEMINI_API_KEY' }` из `vite.config.ts`
- [x] Cloudflare secret `GEMINI_API_KEY` в Worker
- [x] `aiClient.ts`: `API_BASE` использует `VITE_AI_WORKER_URL` для продакшена
- [x] Деплой Worker на Cloudflare
- [x] Деплой Pages на Cloudflare + кастомный домен `rezept-manager.flowgence.de`
- [x] Унифицировать image generation: удалён wrapper `generateRecipeImage`, везде `aiClient.generateImage()`
- [x] Ужесточить prompt `import-from-pdf`: "MUST include 'pageNumber' and 'dishBoundingBox' for every recipe"
- [ ] **TODO (known issue):** Firestore отклоняет рецепты с base64-картинкой > 1 МБ. Фикс: хранить в Cloudflare R2/Firebase Storage, в Firestore только URL. Планируется в Phase 1/хот-фикс.
- [ ] **TODO (Phase 1):** Устранить двойной fetch в `import-from-url` — добавить `rawOgImage` в response schema.
- [ ] **TODO (Phase 1):** Unit-тесты для `worker/src/middleware/rateLimit.ts` через `@cloudflare/vitest-pool-workers`.

## Критерий готовности (DoD)

- `grep -r GEMINI_API_KEY dist/` → 0 совпадений
- Все 6 AI-фич вручную работают через прокси
- Rate limit: 11-й запрос/мин возвращает 429

## Ключевые решения

- `ImportedRecipe.ingredients/steps` переведены с `string` на `string[]` — Gemini возвращает массивы
- `extractImageFromPDF` остаётся на клиенте (Canvas API недоступен в Workers)
- `generateImageDataUri` вынесен в `worker/src/helpers/generateImageDataUri.ts`
- `server.watch.ignored` в `vite.config.ts` для `.claude/`, `.playwright-mcp/`, `worker/` — без этого Claude Code ломал browser-тесты модалок
- Слайс 3–4 (2026-04-19): `sourceUrl?: string` добавлен в `ImportedRecipe`
- Деплой (2026-04-21): `API_BASE` берёт `VITE_AI_WORKER_URL` из env, в dev fallback `""` (Vite proxy)
```

- [ ] **Step 2: Проверить файл**

```bash
wc -l docs/roadmap-archive/phase-0b.md
```

Ожидается: ~40 строк.

---

### Task 3: Создать phase-1.md

**Files:**

- Create: `docs/roadmap-archive/phase-1.md`

- [ ] **Step 1: Создать файл**

Создать `docs/roadmap-archive/phase-1.md`:

```markdown
# Phase 1 — Разбор Монолита

**Статус:** завершено (2026-07-18) — App.tsx: 7500 → 277 строк

## Чеклист

### 1. Доменный слой (Phase 1a) ✅ завершена (2026-04-26)

- [x] `src/shared/domain/types.ts` — все типы из `App.tsx:163-275`
- [x] `src/shared/domain/macros.ts` — sumMacros, remainingMacros, resolveActiveTargets
- [x] `src/shared/domain/allergies.ts` — recipeAllergens, recipeHasAllergens
- [x] `src/features/cart/services/staples.ts` — BASIC_KEYWORDS, isStaple
- [x] Vitest + тесты 100% покрытия (32 теста, 3 файла)

### 2. Сервисный слой (Phase 1b) ✅ завершена (2026-04-27)

- [x] Заменить все 3 вхождения `BASIC_KEYWORDS` в `App.tsx` на `isStaple()`
- [x] Repository-интерфейсы: RecipesRepository, PlannerRepository, ProgramsRepository, CartRepository, UserProfileRepository, NutritionPlanRepository
- [x] Firestore-реализации в `src/infrastructure/firestore/`
- [x] `src/infrastructure/firestore/converters.ts` (Timestamp ↔ ISO)
- [x] Тесты на репозитории с fake реализациями (86 тестов, 0 ошибок TS)

### 3a. Providers и Shell ✅ завершена (2026-04-27)

- [x] `src/app/providers/RepositoryProvider.tsx`
- [x] `src/app/providers/DataProvider.tsx`
- [x] `src/app/providers/UserProfileProvider.tsx`
- [x] `src/app/layout/Shell.tsx`, `TabBar.tsx`
- [x] Перенос `activeNutritionPlan` из localStorage в Firestore `settings/plan`
- [x] Обновить `main.tsx` — обернуть App провайдерами
- [x] Тесты провайдеров (11 тестов: 4 DataProvider + 7 UserProfileProvider)
- [x] Shell.tsx: добавлен `pb-20` для fixed TabBar
- [x] DataProvider unmount тест усилён (listenerCount === 0 для всех 4 репозиториев)

### 3b. i18n ✅ завершена (2026-04-28)

- [x] `npm install i18next react-i18next`
- [x] `src/app/providers/I18nProvider.tsx`
- [x] `src/locales/ru.json`, `de.json`, `en.json`
- [x] Переключатель языка в Settings (ru/de/en)
- [x] Все строки в Shell.tsx и TabBar.tsx через `t()` хук

### 4. По одной вкладке

- [x] Settings → `src/features/settings/SettingsModal.tsx` (2026-04-28)
- [x] Cart → `src/features/cart/CartView.tsx` (2026-04-28)
- [x] Recipes → `src/features/recipes/RecipesView.tsx` (2026-04-28)
- [x] Programs → `src/features/programs/ProgramsView.tsx` + `ProgramDetailModal.tsx` (2026-04-30)
- [x] Planner → `src/features/planner/PlannerView.tsx` (2026-07-18, App.tsx: 2482 → 1395 строк)
- [x] Tracker → `src/features/tracker/TrackerView.tsx` (2026-07-18, App.tsx: 1395 → 540 строк)

### 5. Финальная очистка ✅ завершена (2026-07-18, App.tsx 540 → 277 строк)

- [x] `extractImageFromPDF`/`extractTextFromPDF` → `src/shared/utils/pdfUtils.ts` (3 копии → 1)
- [x] Удалить 3 дублирующих `onSnapshot` (recipes/cart/userProfile)
- [x] `addProductsToCart` перенесена в `ProgramDetailModal`
- [x] `SettingsModal` переведён на `useUserProfile()` контекст
- [x] `AppHeader` + `RecipeSelectionBar` → `src/app/layout/`
- [x] `DEFAULT_PROFILE` → `src/shared/domain/defaults.ts`
- [x] `firebase/firestore` убран из всех feature/shared/app файлов
- [ ] **TODO (future):** `AppHeader` хранит `currentLanguage` локально, не вызывает `changeLanguage()` — язык меняется только визуально. Подключить i18n или убрать переключатель из хедера.

## Критерий готовности (DoD) — выполнен

- `wc -l src/App.tsx` = 277 (< 300 ✅, < 200 требует RecipeSelectionContext)
- `grep -r "firebase/firestore" src/features src/shared src/app` → 0 ✅
- `grep -r "BASIC_KEYWORDS" src/` → 1 match ✅
- 101 тестов, 0 TS-ошибок ✅

## Ключевые решения

- `selectedRecipe`, `isAddingManual/Link/PDF` подняты в App.tsx как controlled props (Programs + Planner обращаются к ним)
- `openProgramId` как controlled prop в App.tsx (паттерн как у `selectedRecipe`)
- `activeNutritionPlan` в Firestore `settings/plan` (не `settings/profile` — разные домены)
- `useEffect` в SettingsModal гейтирован по `isOpen` — предотвращает затирание правок при Firestore snapshot
- `mealTypes` остался в App.tsx (Tracker тоже использует)
- Specs: `docs/superpowers/specs/2026-04-28-programs-extraction-design.md`, `2026-04-30-planner-extraction-design.md`, `2026-07-18-tracker-extraction-design.md`
- Plans: `docs/superpowers/plans/2026-04-28-programs-extraction.md`, `2026-07-18-planner-extraction.md`, `2026-07-18-tracker-extraction.md`, `2026-07-18-app-cleanup.md`
```

- [ ] **Step 2: Проверить файл**

```bash
wc -l docs/roadmap-archive/phase-1.md
```

Ожидается: ~70 строк.

---

### Task 4: Создать phase-2.md

**Files:**

- Create: `docs/roadmap-archive/phase-2.md`

- [ ] **Step 1: Создать файл**

Создать `docs/roadmap-archive/phase-2.md`:

```markdown
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

- AuthProvider рендерит children во время loading (loading:true в контексте); `AuthenticatedApp` добавляет guard `if (loading || !user) return null`
- HIGH-уязвимость: `update` не проверял иммутабельность `userId` → data poisoning. Исправлено: `request.resource.data.userId == resource.data.userId` для всех 4 коллекций (commit `aecde4a`)
- Firebase-проект сменён с `mein-app-25e08` (партнёрский, доступ утерян) на `rezept-manager-62bd0` (личный аккаунт videnejev@gmail.com)
- Spec: `docs/superpowers/specs/2026-07-19-phase2-firebase-auth-design.md`
- Plan: `docs/superpowers/plans/2026-07-18-planner-extraction.md` (Phase 2 реализовывался по нему)
```

- [ ] **Step 2: Проверить файл**

```bash
wc -l docs/roadmap-archive/phase-2.md
```

Ожидается: ~45 строк.

---

### Task 5: Создать decisions-log.md

**Files:**

- Create: `docs/roadmap-archive/decisions-log.md`

- [ ] **Step 1: Создать файл**

Создать `docs/roadmap-archive/decisions-log.md`:

```markdown
# Журнал архитектурных решений

Хронологический лог значимых решений по проекту Recipe Manager.

---

- **2026-04-17** — Supabase выбран для Phase 3 (обоснование: multi-tenant масштаб + стоимость).
- **2026-04-17** — Cloudflare остаётся хостингом (вместо планировавшегося Vercel): free tier выгоднее для Vite-приложения без SSR. Gemini proxy делаем на Cloudflare Workers.
- **2026-04-17** — Next.js миграция отложена до появления реальной SEO-потребности.
- **2026-04-17** — Auth вводится в Phase 2 на Firebase (до переезда в Supabase), чтобы избежать периода «БД без Auth».
- **2026-04-17** — Repository pattern закладывается в Phase 1 (не отдельная фаза).
- **2026-04-17** — Vitest и react-i18next включены в scope Phase 1 (не отдельные фазы).
- **2026-04-17** — `CLAUDE.md` упрощён: удалены дубли Application_description.md, устаревшая структура репозитория, Notes & Decisions Log. Добавлена инфраструктура persistence: `ROADMAP.md`, memory-записи, Stop hook.
- **2026-04-19** — Phase 0a завершена. Firebase config → env, `src/firebase.ts` → `src/infrastructure/firebaseApp.ts`, TS strict + `noUncheckedIndexedAccess`. Strict-mode вскрыл 23 ошибки — все починены без TODO/any. `.playwright-mcp/` в `.gitignore`.
- **2026-04-19** — Phase 0b слайс 1: скаффолдинг `worker/` (Hono, wrangler.toml, 8787, compatibility_date 2026-04-19). 6 POST stub-роутов с CORS. Общие DTO — `src/services/ai/contracts.ts`. Клиент — `src/services/ai/aiClient.ts`. Vite proxy `/api → :8787`. Секреты воркера в `worker/.dev.vars` и через `wrangler secret put`.
- **2026-04-19** — Phase 0b слайс 2 (`generate-image`): `generateRecipeImage` → тонкая обёртка над `aiClient.generateImage`. Known issue: **Firestore отклоняет рецепт с base64 AI-картинкой** — data-URI превышает лимит 1 МБ. Решение отложено (Cloudflare R2 / Firebase Storage в Phase 1).
- **2026-04-19** — Phase 0b слайсы 3–4 (`import-from-url`, `import-from-pdf`): `ingredients/steps` → `string[]`; `sourceUrl?: string` в `ImportedRecipe`; `generateImageDataUri` → хелпер; `extractImageFromPDF` остаётся на клиенте (Canvas API недоступен в Workers); worker-роуты: try/catch + JSON.parse (502), case-insensitive category filter.
- **2026-04-20** — Phase 0b слайсы 5–6 (`import-from-photo`, `fill-remaining`). Все 6 маршрутов активны. `FillRemainingOption` в contracts.ts: поля `id`, `type`, `description`. `FillRemainingRequest` дополнен `planName`.
- **2026-04-21** — Phase 0b деплой: Worker на Cloudflare с `GEMINI_API_KEY`; Pages с доменом `rezept-manager.flowgence.de` (CNAME у HostEurope). `API_BASE` берёт `VITE_AI_WORKER_URL` из env.
- **2026-04-26** — Phase 1a: доменный слой вынесен в `src/shared/domain/` и `src/features/cart/services/`. Vitest 4.x с v8 coverage, 32 теста. `BASIC_KEYWORDS` встречается в App.tsx **3 раза** (не 2). `vitest.config.ts`: `exclude: ['**/.worktrees/**']`.
- **2026-04-27** — Phase 1b: Repository pattern. 6 интерфейсов, 5 Firestore-реализаций, 6 fake in-memory. `TimestampLike` структурный тип. `jsdom` как dev dependency. 86 тестов. Ключевые решения: defensive copy в emit(), `value == null` guard для timestampToISO, `deleteAll` через fresh getDocs.
- **2026-04-27** — Phase 1 Step 3a: провайдеры и Shell. `activeNutritionPlan` в Firestore `settings/plan` (не `settings/profile`). App.tsx сохраняет свои `onSnapshot` до Step 4 — двойные подписки ожидаемое временное состояние. 97 тестов.
- **2026-04-28** — Phase 1 Step 4 (Cart + Recipes): `selectedRecipe`, `isAddingManual/Link/PDF`, `isScanning` подняты как controlled props в App.tsx. App.tsx: 6753 → 4538 строк.
- **2026-04-28** — Phase 1 Step 4 (Programs): дизайн — `openProgramId` как controlled prop; два файла ProgramsView + ProgramDetailModal; `isProgramSelectionOpen` остаётся в App.tsx (Tracker-фича).
- **2026-04-30** — Phase 1 Step 4 (Programs) завершена: App.tsx: 4538 → 2482 строк. `photoInputRef` тип → `RefObject<HTMLInputElement | null>` для React 19.
- **2026-04-30** — Phase 1 Step 4 (Planner) дизайн: один файл `PlannerView.tsx`; `plannerEntries` через `useData()`; `checkedEntries` в App.tsx как controlled prop; `onSelectRecipe` нужен как prop.
- **2026-07-18** — Phase 1 Step 4 (Planner) завершена: App.tsx: 2482 → 1395 строк. `mealTypes` остался в App.tsx; prop `onNavigateToCart` вместо `setActiveTab('cart')`.
- **2026-07-18** — Phase 1 Step 4 (Tracker) завершена: TrackerView + AISuggestModal + ProgramSelectionModal. App.tsx: 1395 → 540 строк. `handleAddSelectedSuggestions` дедуплицирован.
- **2026-07-18** — Phase 1 Step 5 (Финальная очистка) завершена: App.tsx: 540 → 277 строк. `pdfUtils.ts` — одна canonical copy. `useEffect` в SettingsModal гейтирован по `isOpen`.
- **2026-07-19** — Phase 2 реализована: 112 тестов. AuthProvider рендерит children во время loading с `loading:true`; `AuthenticatedApp` guard `if (loading || !user) return null`.
- **2026-07-19** — Phase 1 DoD закрыт: прямые `firebase/firestore` убраны из 8 feature-файлов → `useRepositories()`. `DEFAULT_PROFILE` → `src/shared/domain/defaults.ts`.
- **2026-07-19** — Security review Phase 2: HIGH-уязвимость userId-overwrite в `firestore.rules`. Исправлено: `update` выделен с предикатом `request.resource.data.userId == resource.data.userId` (commit `aecde4a`).
- **2026-07-19** — Firebase-проект сменён с `mein-app-25e08` (партнёрский) на `rezept-manager-62bd0` (личный аккаунт videnejev@gmail.com). `.env` + Cloudflare Pages env обновлены.
- **2026-07-19** — Реструктуризация документации: STATUS.md (дашборд сессии), docs/roadmap-archive/ (завершённые фазы + decisions-log), Technical_Project_Documentation.md. CLAUDE.md обновлён.
```

- [ ] **Step 2: Проверить файл**

```bash
wc -l docs/roadmap-archive/decisions-log.md
```

Ожидается: ~50 строк.

---

### Task 6: Коммит архивных файлов

**Files:**

- Modified: `docs/roadmap-archive/` (5 новых файлов)

- [ ] **Step 1: Закоммитить**

```bash
git add docs/roadmap-archive/
git commit -m "docs: add roadmap archive — phase-0a, 0b, 1, 2, decisions-log"
```

---

### Task 7: Обрезать ROADMAP.md

**Files:**

- Modify: `ROADMAP.md`

- [ ] **Step 1: Заменить содержимое ROADMAP.md**

Перезаписать `ROADMAP.md` следующим содержимым (убраны: «Текущий статус», Phase 0a, 0b, 1, 2, «Журнал решений»):

```markdown
# Recipe Manager — Roadmap

> Активные и будущие фазы. Статус текущей фазы — в `STATUS.md`. Завершённые фазы — в `docs/roadmap-archive/`.

---

## Финальная цель

Превратить Recipe Manager из монолитного прототипа в модульную feature-based архитектуру, готовую к масштабу десятков тысяч пользователей и тысяч консультантов:

1. **Безопасность.** Gemini API-ключ — только на сервере. Firebase/Supabase — только через Auth и Security Rules/RLS.
2. **Модульность.** 6 вкладок — 6 независимых feature-модулей. Shared-доменная логика (КБЖУ, аллергии) — в `shared/domain/`.
3. **Абстракция БД.** Repository-паттерн позволяет переключить Firebase на Supabase одной строкой в `main.tsx`.
4. **Тесты.** Vitest с первого дня, 100% покрытие `shared/domain/`, critical flow tests на allergy check и KBZHU sync.
5. **Целевой стек:** React 19 + Vite + TypeScript strict + Cloudflare Pages + Cloudflare Workers (Gemini proxy) + Supabase (DB + Auth + Realtime) + react-i18next.

---

## Стратегические решения (2026-04-17)

| Вопрос                         | Выбор                                             | Почему                                                                                |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Supabase vs Firebase long-term | **Supabase** (Phase 3)                            | Postgres + RLS подходит для multi-tenant; биллинг за чтения дешевле на масштабе       |
| Хостинг                        | **Cloudflare остаётся**                           | Free tier щедрее Vercel (unlimited bandwidth, 100k Worker req/day)                    |
| Next.js                        | **Отложен**                                       | App-like приложение, SSR не работает с real-time; вернёмся только при SEO-потребности |
| Auth timing                    | **До миграции Supabase** (Phase 2, Firebase Auth) | Избегаем периода «открытая БД без Auth»                                               |
| Phase 1 extras                 | **Vitest + i18n сразу**                           | Тесты страхуют рефакторинг; i18n дешевле ввести при разбиении                         |

---

### Phase 3 — миграция на Supabase (3–4 недели)

**Статус:** [ ] не начата

- [ ] Создать Supabase-проект, настроить Auth (email + Google OAuth)
- [ ] Спроектировать схему (`supabase/migrations/*.sql`):
  - `user_profiles`, `recipes`, `planner_entries`, `cart_items`, `programs`, `program_subfolders`, `program_recipes` (junction)
  - `ingredients`, `steps` → JSONB (не text[])
  - Индексы: `recipes(user_id)`, `planner_entries(user_id, date)`, GIN на categories
- [ ] RLS policies на каждую таблицу (own_select, own_insert, own_update, own_delete)
- [ ] pgtap-тесты RLS: user_A не видит user_B
- [ ] `src/infrastructure/supabase/*Repository.supabase.ts` — реализации интерфейсов
- [ ] `src/infrastructure/createRepositories.ts` — feature flag `VITE_BACKEND=firebase|supabase`
- [ ] Supabase Realtime подписки через `postgres_changes`
- [ ] Reconnect fallback (re-select + diff)
- [ ] Миграционный скрипт `scripts/migrate-firestore-to-supabase.ts`:
  - dry-run режим
  - id mapping (Firestore auto-id → UUID)
  - порядок: users → profiles → recipes → programs → subfolders → planner_entries → cart_items
  - backward-compat для pdfUrl/link полей в programs
  - валидация: row count match, 0 orphan references
- [ ] Auth migration: экспорт scrypt-хешей из Firebase, импорт в Supabase (dry-run на staging сначала)
- [ ] Удалить Firebase после успешного переключения (отдельный commit)

**Критерий готовности:**

- Feature flag переключает бэкенд без UI-изменений
- Real-time: два вкладки под одним юзером — апдейт ≤ 2 сек
- Все 4 regression flows работают на обоих бэкендах
- pgtap тесты зелёные

---

### Phase 4 — Next.js миграция (опционально, 1–3 недели)

**Статус:** [ ] под вопросом

Возвращаемся только если появилась конкретная SEO-потребность (публичные share-страницы программ должны индексироваться). Альтернатива — отдельная static HTML страница для share-view.

---

### Phase 5 — collaboration & premium (по необходимости)

- Shared programs с тонкими permissions
- Консультант ↔ клиент dashboards
- Premium tier, биллинг
- Offline режим (IndexedDB в репозиториях)

---

## Протокол работы над этим roadmap'ом

По ходу работы Claude:

1. Отмечает `[x]` в чеклисте текущей фазы по мере завершения подзадач.
2. При значимом решении добавляет запись в `docs/roadmap-archive/decisions-log.md` с датой.
3. При завершении фазы — создаёт `docs/roadmap-archive/phase-N.md`, убирает фазу из этого файла.
4. Обновляет `STATUS.md` при каждом session end.
```

- [ ] **Step 2: Проверить размер**

```bash
wc -l ROADMAP.md
```

Ожидается: ~80-90 строк (было 304).

---

### Task 8: Создать STATUS.md

**Files:**

- Create: `STATUS.md`

- [ ] **Step 1: Создать файл**

Создать `STATUS.md` в корне проекта:

```markdown
# Recipe Manager — Status

## Активная фаза

Phase 3 — миграция на Supabase (не начата)

## Следующий шаг

Создать Supabase-проект, настроить Auth (email + Google OAuth)

## Blocker

нет

## Обновлено

2026-07-19

---

## Итоги последней сессии

- Phase 2 завершена: Auth email/password + Firestore Security Rules задеплоены, security-review пройден
- Исправлена HIGH-уязвимость: userId-overwrite в firestore.rules (userId immutable при update, commit aecde4a)
- Firebase-проект мигрирован с партнёрского аккаунта на личный (rezept-manager-62bd0, videnejev@gmail.com)
- Phase 1 DoD закрыт: прямые firebase/firestore импорты удалены из всех feature-файлов → useRepositories()
- Реструктурирована документация: STATUS.md, docs/roadmap-archive/, Technical_Project_Documentation.md

## Ключевые решения, влияющие на следующий шаг

- Repository pattern уже реализован — для Supabase нужны только новые реализации интерфейсов из `src/services/`
- Feature flag `VITE_BACKEND=firebase|supabase` переключает бэкенд в `src/infrastructure/createRepositories.ts`
- Миграция данных: dry-run на staging → валидация → prod (порядок: users → profiles → recipes → programs → entries → cart)
- Auth migration: экспорт scrypt-хешей из Firebase, импорт в Supabase

---

## Где искать контекст

- `ROADMAP.md` — активные + будущие фазы (Phase 3, 4, 5)
- `Application_description.md` — бизнес-логика (6 вкладок, AI-правила, UX)
- `Technical_Project_Documentation.md` — архитектура, стек, файловая структура, env vars
- `docs/roadmap-archive/` — завершённые фазы (0a, 0b, 1, 2) + журнал решений
- `docs/superpowers/specs/` — спеки фаз
```

- [ ] **Step 2: Проверить размер**

```bash
wc -l STATUS.md
```

Ожидается: ~35 строк (~280 токенов).

---

### Task 9: Коммит ROADMAP.md + STATUS.md

**Files:**

- Modified: `ROADMAP.md`, `STATUS.md` (новый)

- [ ] **Step 1: Закоммитить**

```bash
git add ROADMAP.md STATUS.md
git commit -m "docs: trim ROADMAP.md to active phases, add STATUS.md dashboard"
```

---

### Task 10: Создать Technical_Project_Documentation.md

**Files:**

- Create: `Technical_Project_Documentation.md`

- [ ] **Step 1: Создать файл**

Создать `Technical_Project_Documentation.md` в корне проекта:

```markdown
# Technical Project Documentation

> Техническая карта проекта для нового члена команды и глубокого контекста.  
> Обновляется при добавлении новых файлов/модулей или изменении внешних сервисов.

---

## 1. Обзор проекта

**Что это:** мобильное/веб-приложение для интеллектуального управления питанием — умная кулинарная книга + планер питания + AI-диетолог.

**Аудитория:** нутрициологи, диетологи, фитнес-тренеры, meal-prep специалисты, health-conscious пользователи. Целевой масштаб — десятки тысяч конечных пользователей, тысячи консультантов.

**Текущий статус:** Phase 2 завершена (Firebase Auth + Security Rules). Phase 3 (Supabase) — следующая. Приложение продакшн-деплоено на `rezept-manager.flowgence.de`.

**6 функциональных вкладок:** Рецепты, Планировщик, Трекер КБЖУ, Корзина, Программы питания, Настройки.

---

## 2. Технический стек

| Слой       | Технология                          | Версия             | Роль                                  |
| ---------- | ----------------------------------- | ------------------ | ------------------------------------- |
| Frontend   | React                               | 19.0               | UI                                    |
| Language   | TypeScript                          | 5.8 strict         | Типизация                             |
| Build      | Vite                                | 6.2                | Bundler + dev server                  |
| Styles     | Tailwind CSS                        | 4.1                | Утилитарные стили                     |
| State      | Context API + Repository pattern    | —                  | Нет внешней state lib                 |
| DB/Backend | Firebase (Firestore + Auth)         | 12.9               | Текущий бэкенд (→ Supabase в Phase 3) |
| AI         | Google Gemini via Cloudflare Worker | @google/genai 1.29 | Импорт рецептов, КБЖУ, AI-советы      |
| Worker     | Hono на Cloudflare Workers          | —                  | Gemini proxy, rate limiting           |
| i18n       | i18next + react-i18next             | 26 / 17            | ru/de/en                              |
| Icons      | lucide-react                        | 0.546              | UI иконки                             |
| Animation  | motion (framer-motion)              | —                  | Анимации                              |
| Dates      | date-fns                            | 4.1                | Работа с датами                       |
| PDF        | pdfjs-dist                          | —                  | Клиентский парсинг PDF (Canvas нужен) |
| Testing    | Vitest + @testing-library/react     | 4.1                | 112 тестов                            |
| Hosting    | Cloudflare Pages + Workers          | —                  | Фронтенд + AI proxy                   |

---

## 3. Архитектура

### Слои приложения
```

src/shared/domain/ ← доменная логика (типы, macros, allergies) — нет внешних зависимостей
src/services/ ← интерфейсы репозиториев (TypeScript interfaces) + AI contracts
src/infrastructure/ ← реализации репозиториев (Firestore, fake/testing)
src/features/ ← 6 feature-модулей (auth, recipes, planner, tracker, cart, programs, settings)
src/app/ ← providers, layout (Shell, TabBar, AppHeader)
worker/ ← Cloudflare Worker: Gemini proxy + rate limiting

```

### Provider tree (main.tsx)

```

StrictMode
└── AuthProvider Firebase Auth: onAuthStateChanged
└── AuthenticatedApp Guard: if (loading || !user) return null
└── I18nProvider i18next setup (ru/de/en)
└── RepositoryProvider Инъекция 6 Firestore-реализаций через Context
└── DataProvider Reactive onSnapshot (recipes, planner, cart, programs)
└── UserProfileProvider userProfile + activeNutritionPlan
└── Shell Layout wrapper (min-h-screen, pb-20)
└── App Cross-tab state + routing (useState)

````

### Repository pattern

- **Интерфейсы** в `src/services/` — не зависят от Firebase (можно заменить на Supabase)
- **Firestore-реализации** в `src/infrastructure/firestore/` — uid-scoped через конструктор
- **Fake-реализации** в `src/infrastructure/testing/` — in-memory, для тестов
- **Переключение бэкенда:** `VITE_BACKEND=firebase|supabase` в `src/infrastructure/createRepositories.ts` (планируется в Phase 3)

### Data flow

**Добавление рецепта вручную:**
1. `RecipesView` → `aiClient.calculateKbzhu()` (если нужно)
2. Worker `/api/ai/calculate-kbzhu` → Gemini → ответ
3. `recipesRepo.add(recipe)` из `RepositoryContext`
4. Firestore → `onSnapshot` в `DataProvider` → `DataContext` → UI

**Импорт из PDF:**
1. Клиент: `extractTextFromPDF` / `extractImageFromPDF` через `pdfjs-dist` (Canvas → только на клиенте)
2. `aiClient.importFromPdf({ text/imageData, pageNumber, dishBoundingBox })`
3. Worker `/api/ai/import-from-pdf` → Gemini → `ImportedRecipe`
4. Если `dishBoundingBox` есть → `extractImageFromPDF` crop → `aiClient.generateImage()` → data URI
5. `recipesRepo.add()` → Firestore

**AI fill remaining КБЖУ:**
1. `TrackerView` вычисляет remaining macros через `remainingMacros()`
2. `aiClient.fillRemaining({ remaining, allergies, activeProgram, recipeLibrary })`
3. Worker → Gemini → 3 варианта (`FillRemainingOption[]`)
4. `AISuggestModal` → выбор → `plannerRepo.add()`

**Авторизация:**
1. `LoginScreen` → `signInWithEmailAndPassword(auth, email, password)`
2. Firebase Auth → `AuthProvider.onAuthStateChanged` → `user.uid` в `AuthContext`
3. `RepositoryProvider(uid)` → все репозитории uid-scoped
4. `DataProvider.onSnapshot` фильтрует `where('userId', '==', uid)`

---

## 4. Структура файлов

### `src/shared/domain/` — доменный слой, нет внешних зависимостей
| Файл | Роль |
|------|------|
| `types.ts` | Все TypeScript типы: Recipe, PlannerEntry, Program, CartItem, UserProfile, NutritionPlan |
| `macros.ts` | sumMacros(), remainingMacros(), resolveActiveTargets() |
| `allergies.ts` | recipeAllergens(), recipeHasAllergens() |
| `defaults.ts` | DEFAULT_PROFILE — дефолтные значения профиля |

### `src/services/` — интерфейсы и AI contracts
| Файл | Роль |
|------|------|
| `RecipesRepository.ts` | Интерфейс: subscribe, add, update, delete, deleteAll |
| `PlannerRepository.ts` | Интерфейс: subscribe, add, update, delete |
| `CartRepository.ts` | Интерфейс: subscribe, add, update, delete, deleteAll |
| `ProgramsRepository.ts` | Интерфейс: subscribe, add, update, delete |
| `UserProfileRepository.ts` | Интерфейс: subscribe, save |
| `NutritionPlanRepository.ts` | Интерфейс: subscribe, save |
| `ai/contracts.ts` | DTO для 6 AI-маршрутов (Request/Response пары) |
| `ai/aiClient.ts` | Типизированный POST-клиент для Cloudflare Worker |

### `src/infrastructure/` — реализации
| Файл/папка | Роль |
|-----------|------|
| `firebaseApp.ts` | Firebase app singleton |
| `firebaseAuth.ts` | Firebase Auth singleton |
| `firestore/FirestoreRecipesRepository.ts` | Реализация, uid-scoped, userId в writes |
| `firestore/FirestorePlannerRepository.ts` | То же для planner |
| `firestore/FirestoreCartRepository.ts` | То же для cart |
| `firestore/FirestoreProgramsRepository.ts` | То же для programs |
| `firestore/FirestoreUserProfileRepository.ts` | userProfiles/{uid} |
| `firestore/FirestoreNutritionPlanRepository.ts` | nutritionPlans/{uid} |
| `firestore/converters.ts` | Timestamp ↔ ISO string |
| `testing/Fake*.ts` | 6 in-memory реализаций для тестов |
| `testing/FakeAuthProvider.tsx` | AuthProvider заглушка для тестов |
| `LocalStorageNutritionPlanRepository.ts` | localStorage fallback |

### `src/features/` — 6 feature-модулей
| Папка | Ключевые файлы | Роль |
|-------|--------------|------|
| `auth/` | AuthProvider.tsx, AuthContext.ts, useAuth.ts, LandingPage.tsx, LoginScreen.tsx, SignupScreen.tsx | Firebase Auth flow |
| `recipes/` | RecipesView.tsx | 5 методов импорта: вручную, URL, PDF, фото, ссылка |
| `planner/` | PlannerView.tsx | Day/week/month/list вьюхи планировщика |
| `tracker/` | TrackerView.tsx, AISuggestModal.tsx, ProgramSelectionModal.tsx | КБЖУ трекер + AI советы |
| `cart/` | CartView.tsx, services/staples.ts | Список покупок + классификатор базовых продуктов |
| `programs/` | ProgramsView.tsx, ProgramDetailModal.tsx | Иерархия программ и подпапок |
| `settings/` | SettingsModal.tsx | Профиль, аллергии, цели, язык, выход |

### `src/app/` — providers и layout
| Файл | Роль |
|------|------|
| `providers/RepositoryProvider.tsx` | Инъекция 6 Firestore-реализаций через Context |
| `providers/DataProvider.tsx` | Reactive onSnapshot подписки (recipes, planner, cart, programs) |
| `providers/UserProfileProvider.tsx` | userProfile + activeNutritionPlan |
| `providers/I18nProvider.tsx` | i18next setup |
| `layout/Shell.tsx` | min-h-screen wrapper с pb-20 для fixed TabBar |
| `layout/TabBar.tsx` | Нижняя навигация (5 вкладок) |
| `layout/AppHeader.tsx` | Верхний заголовок |
| `layout/RecipeSelectionBar.tsx` | Бар выбора рецептов для Programs |

### `src/locales/` — переводы
`ru.json`, `de.json`, `en.json` — ключи для Shell, TabBar и UI-строк.

### `worker/` — Cloudflare Worker (Hono)
| Файл | Роль |
|------|------|
| `src/index.ts` | Роутинг: 6 POST маршрутов, CORS, rate limiting middleware |
| `src/routes/generateImage.ts` | Gemini image generation (gemini-2.5-flash-image) |
| `src/routes/calculateKbzhu.ts` | Расчёт КБЖУ по ингредиентам |
| `src/routes/importFromUrl.ts` | Импорт рецепта с URL + og:image |
| `src/routes/importFromPdf.ts` | Импорт рецепта из PDF (текст + изображение) |
| `src/routes/importFromPhoto.ts` | Импорт рецепта из фото |
| `src/routes/fillRemaining.ts` | AI fill remaining КБЖУ (3 варианта) |
| `src/middleware/rateLimit.ts` | Token bucket: 10 req/min на IP через KV |
| `src/helpers/generateImageDataUri.ts` | Хелпер генерации data URI через Gemini |
| `src/types.ts` | Env type: GEMINI_API_KEY (secret), RATE_LIMIT_KV (KV binding) |

---

## 5. Внешние сервисы

### Firebase
- **Проект:** `rezept-manager-62bd0` (личный аккаунт videnejev@gmail.com)
- **Dashboard:** [console.firebase.google.com](https://console.firebase.google.com) → проект `rezept-manager-62bd0`
- **Firestore:** данные пользователей — коллекции `recipes`, `planner_entries`, `cart_items`, `programs`, `userProfiles`, `nutritionPlans`. Все uid-scoped (`where('userId', '==', uid)`).
- **Auth:** email/password (Google OAuth — Phase 2b, не реализован)
- **Security Rules:** `firestore.rules` — `request.auth.uid == resource.data.userId`, userId immutable при update

### Cloudflare
- **Аккаунт:** связан с videnejev@gmail.com
- **Dashboard:** [dash.cloudflare.com](https://dash.cloudflare.com)
- **Pages:** фронтенд, деплоится автоматически из `main` ветки. Домен `rezept-manager.flowgence.de` (CNAME к Cloudflare; основной домен `flowgence.de` у HostEurope).
- **Worker:** `rezept-manager-ai-proxy` — Gemini API прокси (6 маршрутов `/api/ai/*`)
- **KV:** namespace `RATE_LIMIT_KV` — хранение счётчиков rate limiting

### Google Gemini (AI Studio)
- **Ключ:** Cloudflare secret `GEMINI_API_KEY` — **никогда не в клиентском коде**
- **Модели:**
  - `gemini-2.5-flash` — import-from-url, import-from-pdf, import-from-photo, calculate-kbzhu, fill-remaining
  - `gemini-2.5-flash-image` — generate-image (aspectRatio 4:3, imageSize 1K)
- **Rate limit:** 10 req/min на IP (token bucket в Cloudflare KV). 11-й запрос → 429 + Retry-After.

---

## 6. Переменные окружения

### Frontend `.env` / `.env.local`

| Переменная | Описание | Где получить | Кто использует |
|-----------|---------|------------|--------------|
| `VITE_FIREBASE_API_KEY` | Firebase web API key | Firebase Console → Project Settings → General → Your apps | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain (`rezept-manager-62bd0.firebaseapp.com`) | Firebase Console | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID (`rezept-manager-62bd0`) | Firebase Console | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket | Firebase Console | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging sender ID | Firebase Console | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | Firebase Console | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Analytics ID (опционально) | Firebase Console | `src/infrastructure/firebaseApp.ts` |
| `VITE_AI_WORKER_URL` | URL Cloudflare Worker. **В dev: пусто** (Vite proxy `/api → :8787`). **В prod:** `https://rezept-manager-ai-proxy.<account>.workers.dev` | Cloudflare Dashboard → Workers | `src/services/ai/aiClient.ts` |

Шаблон: `.env.example` в корне.

### Worker `worker/.dev.vars` (локально) / Cloudflare secrets (продакшн)

| Переменная | Тип | Описание | Как задать |
|-----------|-----|---------|------------|
| `GEMINI_API_KEY` | Secret | Google Gemini API ключ | Локально: `worker/.dev.vars`. Продакшн: `wrangler secret put GEMINI_API_KEY` |
| `RATE_LIMIT_KV` | KV binding | Namespace для rate limiting — не строка, а binding | `wrangler.toml` → `kv_namespaces`, создать в Cloudflare Dashboard |

---

## 7. Локальная разработка

```bash
# 1. Установить зависимости
npm install
cd worker && npm install && cd ..

# 2. Настроить env
cp .env.example .env
# Заполнить VITE_FIREBASE_* из Firebase Console (проект rezept-manager-62bd0)
# VITE_AI_WORKER_URL оставить пустым — Vite proxy перенаправит /api → Worker

# 3. Создать worker/.dev.vars
echo 'GEMINI_API_KEY="your-key-here"' > worker/.dev.vars

# 4. Запустить Worker (отдельный терминал)
cd worker && npx wrangler dev   # http://localhost:8787

# 5. Запустить фронтенд (отдельный терминал)
npm run dev   # http://localhost:5173

# 6. Проверить
# Открыть http://localhost:5173
# Зарегистрироваться/войти → убедиться что AI-фичи работают (calculate КБЖУ)
````

---

## 8. Деплой

### Фронтенд (Cloudflare Pages)

```bash
git push origin main
# Pages деплоится автоматически
# Env переменные: Cloudflare Dashboard → Pages → rezept-manager → Settings → Environment variables
```

### Worker (Cloudflare Workers)

```bash
cd worker
npx wrangler deploy
# Установить секрет: wrangler secret put GEMINI_API_KEY
# KV binding настраивается в wrangler.toml и Cloudflare Dashboard
```

---

## 9. Тестирование

```bash
npm test              # все тесты
npm run coverage      # с coverage report
```

**Что покрыто (112 тестов):**

- `src/shared/domain/` — 100%: macros (sumMacros, remainingMacros, resolveActiveTargets), allergies (recipeAllergens, recipeHasAllergens), staples (isStaple)
- `src/infrastructure/testing/` — contract tests для 6 Fake-репозиториев (FakeRecipes, FakePlanner, FakeCart, FakePrograms, FakeUserProfile, FakeNutritionPlan)
- `src/infrastructure/firestore/converters.ts` — Timestamp ↔ ISO
- `src/infrastructure/LocalStorageNutritionPlanRepository.ts`
- `src/app/providers/` — DataProvider (4 теста: subscribe, mutate, unmount, listener cleanup), UserProfileProvider (7 тестов)
- `src/features/auth/` — AuthProvider, LoginScreen, SignupScreen (sign in flow, errors, loading state)
- `src/features/planner/` — PlannerView smoke tests
- `src/features/tracker/` — TrackerView smoke tests

**Что НЕ покрыто:**

- `worker/` — Cloudflare Worker (требует `@cloudflare/vitest-pool-workers`, TODO в Phase 0b)
- E2E тесты (Playwright не настроен)
- `RecipesView`, `ProgramsView`, `CartView` — только ручное тестирование
- 4 regression flows (allergy check, KBZHU sync, fillRemaining, share-linking) — только ручное

---

## 10. Технические ограничения

| Ограничение                                 | Причина                                                         | Как обойти                                                                      |
| ------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Firestore: не хранить base64-картинки       | Лимит документа ~1 МБ; AI-generated images ~700 КБ+             | Cloudflare R2 / Firebase Storage → писать только URL в Firestore (Phase 1 TODO) |
| `GEMINI_API_KEY` только в Cloudflare secret | Безопасность — ключ не должен попасть в клиентский бандл        | Всегда через Worker proxy `/api/ai/*`                                           |
| Canvas API недоступен в Cloudflare Worker   | Workers runtime не поддерживает Canvas                          | PDF-операции (`extractImageFromPDF`) только на клиенте через `pdfjs-dist`       |
| `App.tsx` < 300 строк (не < 200)            | Достигнуто 277; < 200 требует отдельного RecipeSelectionContext | Запланировано как future TODO                                                   |
| AppHeader: язык меняется только визуально   | `changeLanguage()` i18n не вызывается                           | Подключить i18n или убрать переключатель из хедера (future TODO)                |

````

- [ ] **Step 2: Проверить файл**

```bash
wc -l Technical_Project_Documentation.md
````

Ожидается: ~230-260 строк.

---

### Task 11: Обновить CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Обновить раздел «Где лежат детали»**

Заменить в `CLAUDE.md` раздел «Где лежат детали»:

Было:

```markdown
## Где лежат детали

- **Бизнес-логика и продуктовые фичи** — `Application_description.md` в корне проекта (authoritative source по поведению 6 вкладок, правилам AI, UX-логике). Читай его, когда задача касается продуктового поведения — не полагайся на память этого файла.
- **Архитектурный план и текущий статус рефакторинга** — `ROADMAP.md` в корне. Читай в начале каждой сессии, в первом сообщении пользователю подтверждай текущую фазу и следующий шаг.
```

Стало:

```markdown
## Где лежат детали

- **Статус текущей сессии** — `STATUS.md` в корне. Читай в начале каждой сессии (~300 токенов).
- **Бизнес-логика и продуктовые фичи** — `Application_description.md` в корне (authoritative source по поведению 6 вкладок, правилам AI, UX-логике). Читай когда задача касается продуктового поведения.
- **Активные и будущие фазы** — `ROADMAP.md` в корне. Читай при работе над плановой фазой.
- **Техническая документация** — `Technical_Project_Documentation.md` в корне. Читай при необходимости глубокого технического контекста (архитектура, env vars, деплой, ограничения).
- **Завершённые фазы и решения** — `docs/roadmap-archive/` (phase-0a.md, phase-0b.md, phase-1.md, phase-2.md, decisions-log.md).
```

- [ ] **Step 2: Обновить Session start protocol**

Заменить раздел «Session start protocol»:

Было:

```markdown
## Session start protocol

1. Прочитай `ROADMAP.md` → раздел «Текущий статус».
2. Одним предложением сообщи пользователю: активная фаза, следующий шаг, дата последнего обновления.
3. Дождись подтверждения, что работаем над этим шагом (или переключаемся на ad-hoc задачу).
```

Стало:

```markdown
## Session start protocol

1. Прочитай `STATUS.md` — активная фаза, следующий шаг, дата.
2. Одним предложением сообщи пользователю: активная фаза, следующий шаг, дата обновления.
3. Дождись подтверждения.
   - Если работаем по плану → прочитай `ROADMAP.md` для деталей текущей фазы.
   - Если ad-hoc задача → читай нужный контекст по ситуации (TechDoc, Application_description.md и т.д.).
```

- [ ] **Step 3: Обновить Session end protocol**

Заменить блок шагов в «Session end protocol» (при триггере, до прощания):

Было:

```markdown
1. **Обнови `ROADMAP.md` → «Текущий статус»:**
   - Отметь `[x]` те подзадачи текущей фазы, которые завершили в этой сессии.
   - Обнови поле «Следующий шаг» (чтобы в следующей сессии было точно видно, с чего начинать).
   - Обнови «Blocker» если появился или снялся.
   - Обнови дату «Обновлено» на сегодняшнюю.
   - Если перешли в следующую фазу — смени «Активная фаза».

2. **Обнови `Application_description.md`** — если в ходе сессии менялась продуктовая/бизнес-логика (новая фича, изменение правил, удаление возможности). Если бизнес-логика не менялась — пропусти этот шаг.

3. **Добавь запись в `ROADMAP.md` → «Журнал решений»** — если в сессии было значимое архитектурное решение (выбор библиотеки, смена подхода, обнаружение блокера, отказ от ранее планировавшегося).
```

Стало:

```markdown
1. **Обнови `STATUS.md`:**
   - Активная фаза, следующий шаг, blocker, дата «Обновлено».
   - Раздел «Итоги последней сессии» (3-5 пунктов: что сделано в этой сессии).
   - Раздел «Ключевые решения, влияющие на следующий шаг» (решения из этой сессии).

1a. **Если в сессии фаза завершена** (все подзадачи [x]):

- Создай `docs/roadmap-archive/phase-N.md` с полным содержимым фазы (чеклист, DoD, ключевые решения).
- Убери завершённую фазу из `ROADMAP.md`.
- Добавь решения сессии в `docs/roadmap-archive/decisions-log.md`.

2. **Обнови `ROADMAP.md`** — отметь `[x]` подзадачи текущей фазы, завершённые в этой сессии.

3. **Обнови `Application_description.md`** — если в ходе сессии менялась продуктовая/бизнес-логика. Если нет — пропусти.

4. **Добавь запись в `docs/roadmap-archive/decisions-log.md`** — если было значимое архитектурное решение (выбор библиотеки, смена подхода, обнаружение блокера).
```

- [ ] **Step 4: Добавить правило обновления TechDoc**

После раздела «Development conventions» добавить новый раздел:

```markdown
## Technical documentation update rule

При добавлении нового файла или модуля → обновить раздел «Структура файлов» в `Technical_Project_Documentation.md`.

При изменении env-переменных, деплоя или внешних сервисов → обновить соответствующий раздел в `Technical_Project_Documentation.md`.
```

- [ ] **Step 5: Проверить CLAUDE.md**

```bash
grep -n "STATUS.md\|ROADMAP.md\|Technical_Project_Documentation" CLAUDE.md
```

Ожидается: минимум 6 совпадений (STATUS.md — в 2 местах, ROADMAP.md — в 2 местах, Technical_Project_Documentation — в 2 местах).

---

### Task 12: Финальный коммит

**Files:**

- Modified: `Technical_Project_Documentation.md` (новый), `CLAUDE.md`

- [ ] **Step 1: Проверить всё готово**

```bash
ls -la STATUS.md ROADMAP.md Technical_Project_Documentation.md
ls docs/roadmap-archive/
```

Ожидается: 5 файлов в `docs/roadmap-archive/` (phase-0a, phase-0b, phase-1, phase-2, decisions-log), все 3 корневых файла существуют.

- [ ] **Step 2: Финальный коммит**

```bash
git add Technical_Project_Documentation.md CLAUDE.md
git commit -m "docs: add Technical_Project_Documentation.md, update CLAUDE.md protocols"
```

- [ ] **Step 3: Проверить итог**

```bash
git log --oneline -5
wc -l STATUS.md ROADMAP.md Technical_Project_Documentation.md
```

Ожидаемый вывод лога:

```
<hash> docs: add Technical_Project_Documentation.md, update CLAUDE.md protocols
<hash> docs: trim ROADMAP.md to active phases, add STATUS.md dashboard
<hash> docs: add roadmap archive — phase-0a, 0b, 1, 2, decisions-log
```

Ожидаемый размер файлов: STATUS.md ~35 строк, ROADMAP.md ~85 строк, Technical_Project_Documentation.md ~250 строк.

---

## Self-Review

**Spec coverage:**

- [x] STATUS.md (~25-30 строк, все разделы) → Task 8
- [x] ROADMAP.md обрезан до Phase 3+ → Task 7
- [x] `docs/roadmap-archive/` с 4 файлами фаз + decisions-log → Tasks 1-5
- [x] Auto-архивация при session end → Task 11 (Step 3, шаг 1a в протоколе)
- [x] Technical_Project_Documentation.md с 11 разделами → Task 10
- [x] CLAUDE.md: session start читает STATUS.md → Task 11 (Step 2)
- [x] CLAUDE.md: session end обновляет STATUS.md + архивирует фазы → Task 11 (Step 3)
- [x] CLAUDE.md: правило обновления TechDoc → Task 11 (Step 4)
- [x] Токен-стоимость старта: STATUS.md ~35 строк vs ROADMAP.md 304 строки → критерий выполнен

**Нет плейсхолдеров:** все файлы содержат полное содержимое.

**Консистентность:** все ссылки на файлы (STATUS.md, docs/roadmap-archive/, Technical_Project_Documentation.md) согласованы между CLAUDE.md, STATUS.md и ROADMAP.md.
