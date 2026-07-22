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
src/shared/domain/      ← доменная логика (типы, macros, allergies) — нет внешних зависимостей
src/services/           ← интерфейсы репозиториев (TypeScript interfaces) + AI contracts
src/infrastructure/     ← реализации репозиториев (Firestore, fake/testing)
src/features/           ← 6 feature-модулей (auth, recipes, planner, tracker, cart, programs, settings)
src/app/                ← providers, layout (Shell, TabBar, AppHeader)
worker/                 ← Cloudflare Worker: Gemini proxy + rate limiting
```

### Provider tree (main.tsx)

```
StrictMode
└── AuthProvider                    Firebase Auth: onAuthStateChanged
    └── AuthenticatedApp            Guard: if (loading || !user) return null
        └── I18nProvider            i18next setup (ru/de/en)
            └── RepositoryProvider  Инъекция 6 Firestore-реализаций через Context
                └── DataProvider    Reactive onSnapshot (recipes, planner, cart, programs)
                    └── UserProfileProvider  userProfile + activeNutritionPlan
                        └── Shell   Layout wrapper (min-h-screen, pb-20)
                            └── App Cross-tab state + routing (useState)
```

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

| Файл           | Роль                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| `types.ts`     | Все TypeScript типы: Recipe, PlannerEntry, Program, CartItem, UserProfile, NutritionPlan |
| `macros.ts`    | sumMacros(), remainingMacros(), resolveActiveTargets(), scaleMacros() (CONV-1)           |
| `allergies.ts` | recipeAllergens(), recipeHasAllergens()                                                  |
| `defaults.ts`  | DEFAULT_PROFILE — дефолтные значения профиля                                             |

### `src/services/` — интерфейсы и AI contracts

| Файл                         | Роль                                                                |
| ---------------------------- | ------------------------------------------------------------------- |
| `RecipesRepository.ts`       | Интерфейс: subscribeAll, add, update, delete, getById               |
| `PlannerRepository.ts`       | Интерфейс: subscribeAll, add, delete (нет update)                   |
| `CartRepository.ts`          | Интерфейс: subscribe, add, update, delete, deleteAll                |
| `ProgramsRepository.ts`      | Интерфейс: subscribeAll, add, update, delete, getById               |
| `UserProfileRepository.ts`   | Интерфейс: subscribe, save                                          |
| `NutritionPlanRepository.ts` | Интерфейс: get(): Promise\<ActiveNutritionPlan \| null\>, set(plan) |
| `ai/contracts.ts`            | DTO для 6 AI-маршрутов (Request/Response пары)                      |
| `ai/aiClient.ts`             | Типизированный POST-клиент для Cloudflare Worker                    |

### `src/infrastructure/` — реализации

| Файл/папка                                      | Роль                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firebaseApp.ts`                                | Firebase app singleton (Firestore, Auth, Storage)                                                                                                                                                                                                       |
| `firebaseAuth.ts`                               | Firebase Auth singleton                                                                                                                                                                                                                                 |
| `firebaseStorage.ts`                            | `resolveImageField()` — загрузка base64 data URI в Firebase Storage (`users/{uid}/{folder}/`), возвращает Storage URL; используется репозиториями Recipes/Programs перед записью в Firestore (CRIT-1, `docs/audits/2026-07-19-project-audit-report.md`) |
| `firestore/FirestoreRecipesRepository.ts`       | Реализация, uid-scoped, userId в writes, image-поле прогоняется через `resolveImageField()`                                                                                                                                                             |
| `firestore/FirestorePlannerRepository.ts`       | То же для planner                                                                                                                                                                                                                                       |
| `firestore/FirestoreCartRepository.ts`          | То же для cart                                                                                                                                                                                                                                          |
| `firestore/FirestoreProgramsRepository.ts`      | То же для programs; image и subfolders[].image прогоняются через `resolveImageField()`                                                                                                                                                                  |
| `firestore/FirestoreUserProfileRepository.ts`   | userProfiles/{uid}                                                                                                                                                                                                                                      |
| `firestore/FirestoreNutritionPlanRepository.ts` | nutritionPlans/{uid}                                                                                                                                                                                                                                    |
| `firestore/converters.ts`                       | Timestamp ↔ ISO string                                                                                                                                                                                                                                  |
| `testing/Fake*.ts`                              | 6 in-memory реализаций для тестов                                                                                                                                                                                                                       |
| `testing/FakeAuthProvider.tsx`                  | AuthProvider заглушка для тестов                                                                                                                                                                                                                        |
| `LocalStorageNutritionPlanRepository.ts`        | Не подключён нигде (`RepositoryProvider` использует только `FirestoreNutritionPlanRepository`) — мёртвый код, см. DEAD-1 в отчёте аудита                                                                                                                |

### `src/features/` — 6 feature-модулей

| Папка       | Ключевые файлы                                                                                   | Роль                                               |
| ----------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `auth/`     | AuthProvider.tsx, AuthContext.ts, useAuth.ts, LandingPage.tsx, LoginScreen.tsx, SignupScreen.tsx | Firebase Auth flow                                 |
| `recipes/`  | 7 файлов + оркестратор (см. таблицу ниже, CONV-1)                                                | 5 методов импорта: вручную, URL, PDF, фото, ссылка |
| `planner/`  | PlannerView.tsx                                                                                  | Day/week/month/list вьюхи планировщика             |
| `tracker/`  | TrackerView.tsx, AISuggestModal.tsx, ProgramSelectionModal.tsx                                   | КБЖУ трекер + AI советы                            |
| `cart/`     | CartView.tsx, services/staples.ts                                                                | Список покупок + классификатор базовых продуктов   |
| `programs/` | ProgramsView.tsx, ProgramDetailModal.tsx                                                         | Иерархия программ и подпапок                       |
| `settings/` | SettingsModal.tsx                                                                                | Профиль, аллергии, цели, язык, выход               |

### `src/features/recipes/` — декомпозирован на оркестратор + 7 файлов (CONV-1, `docs/audits/2026-07-19-project-audit-report.md`)

| Файл                      | Роль                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RecipesView.tsx`         | Оркестратор (333 строки): состояние формы add/edit, `toggleFavorite`, `handleEdit`, единственный вызов `useRecipeFilters`, JSX-скелет (toolbar/sidebar/grid/модалки) |
| `RecipesEmptyState.tsx`   | Пустое состояние библиотеки (4 CTA: фото/PDF/ссылка/вручную)                                                                                                          |
| `RecipeCard.tsx`          | Карточка рецепта в гриде: drag-start, selection-mode чекбокс, allergen-бейдж, favorite-toggle                                                                        |
| `useRecipeFilters.ts`     | Вся логика поиска/фильтрации/сортировки рецептов; вызывается ровно один раз, в `RecipesView.tsx`                                                                     |
| `RecipesToolbar.tsx`      | Sticky-тулбар: поиск, переключатель Все/Избранное, фильтр-дропдаун, дропдаун добавления рецепта                                                                      |
| `RecipeFilterSidebar.tsx` | Десктопный постоянный сайдбар с теми же фильтрами (тот же `useRecipeFilters`, без дублирования состояния)                                                            |
| `AddRecipeModals.tsx`     | Модалки добавления/редактирования: вручную, по ссылке, PDF, фото (cross-tab), продукт-в-рецепт, delete-confirm                                                       |
| `RecipeDetailModal.tsx`   | Детальная модалка: степпер порций (`scaleMacros()`), пересчёт КБЖУ, планирование, коллекции, share, delete                                                            |

### `src/app/` — providers и layout

| Файл                                | Роль                                                            |
| ----------------------------------- | --------------------------------------------------------------- |
| `providers/RepositoryProvider.tsx`  | Инъекция 6 Firestore-реализаций через Context                   |
| `providers/DataProvider.tsx`        | Reactive onSnapshot подписки (recipes, planner, cart, programs) |
| `providers/UserProfileProvider.tsx` | userProfile + activeNutritionPlan                               |
| `providers/I18nProvider.tsx`        | i18next setup                                                   |
| `layout/Shell.tsx`                  | min-h-screen wrapper с pb-20 для fixed TabBar                   |
| `layout/TabBar.tsx`                 | Нижняя навигация (5 вкладок)                                    |
| `layout/AppHeader.tsx`              | Верхний заголовок                                               |
| `layout/RecipeSelectionBar.tsx`     | Бар выбора рецептов для Programs                                |

### `src/locales/` — переводы

`ru.json`, `de.json`, `en.json` — ключи для Shell, TabBar и UI-строк.

### `worker/` — Cloudflare Worker (Hono)

| Файл                                  | Роль                                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                        | Роутинг: 6 POST маршрутов, CORS, rate limiting middleware                                                  |
| `src/routes/generateImage.ts`         | Gemini image generation (gemini-2.5-flash-image)                                                           |
| `src/routes/calculateKbzhu.ts`        | Расчёт КБЖУ по ингредиентам                                                                                |
| `src/routes/importFromUrl.ts`         | Импорт рецепта с URL + og:image                                                                            |
| `src/routes/importFromPdf.ts`         | Импорт рецепта из PDF (текст + изображение)                                                                |
| `src/routes/importFromPhoto.ts`       | Импорт рецепта из фото                                                                                     |
| `src/routes/fillRemaining.ts`         | AI fill remaining КБЖУ (3 варианта)                                                                        |
| `src/middleware/rateLimit.ts`         | Счётчик по календарной минуте: 10 req/min на IP через KV (ключ `rate:{ip}:{Math.floor(Date.now()/60000)}`) |
| `src/helpers/generateImageDataUri.ts` | Хелпер генерации data URI через Gemini                                                                     |
| `src/types.ts`                        | Env type: GEMINI_API_KEY (secret), RATE_LIMIT_KV (KV binding)                                              |

### `scripts/` — служебные скрипты (запускаются вручную, вне сборки приложения)

| Файл                     | Роль                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `migrate-assign-user.ts` | Одноразовая миграция Firestore: проставляет `userId` во всех документах `recipes`/`planner`/`cart`/`programs`, где поле отсутствует, и переносит singleton-документы `settings/profile` → `userProfiles/{uid}`, `settings/plan` → `nutritionPlans/{uid}`. Нужна была для перехода на uid-scoped данные (multi-user). Переменные окружения: `GOOGLE_APPLICATION_CREDENTIALS` (путь к service account JSON, firebase-admin), `MIGRATION_USER_UID` (uid, на который переносятся данные) |

### `docs/claude-code/` — резервные копии настроек Claude Code

| Файл                       | Роль                                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project-audit-skill.md`   | Точная копия user-level скилла `~/.claude/skills/project-audit/SKILL.md` (не хранится в самом Claude Code внутри репозитория). Нужна для восстановления скилла при переезде на новый компьютер — см. §11.5 |

---

## 5. Внешние сервисы

### Firebase

- **Проект:** `rezept-manager-62bd0` (личный аккаунт videnejev@gmail.com)
- **Dashboard:** https://console.firebase.google.com → проект `rezept-manager-62bd0`
- **Credentials:** запись в пароль-менеджере — «Evgeny's Google Login»
- **Firestore:** данные пользователей — коллекции `recipes`, `planner`, `cart`, `programs`, `userProfiles`, `nutritionPlans`. Все uid-scoped (`where('userId', '==', uid)`).
- **Auth:** email/password (Google OAuth — Phase 2b, не реализован)
- **Security Rules:** `firestore.rules` — `request.auth.uid == resource.data.userId`, userId immutable при update
- **Storage:** бакет `VITE_FIREBASE_STORAGE_BUCKET`, пути `users/{uid}/{recipeImages|programImages|subfolderImages}/{fileId}`. AI-generated/загруженные base64-изображения рецептов и программ хранятся здесь (не в Firestore) — см. `src/infrastructure/firebaseStorage.ts`. **Security Rules:** `storage.rules` — uid-scoped, лимит 5MB, только `image/*`. Деплоится вручную через Firebase Console → Storage → Rules (как и `firestore.rules`, CLI не настроен).

### Cloudflare

- **Аккаунт:** связан с videnejev@gmail.com
- **Dashboard:** https://dash.cloudflare.com
- **Credentials:** запись в пароль-менеджере — «Cloudflare Rezept-Manager»
- **Pages:** фронтенд, деплоится автоматически из `main` ветки. Домен `rezept-manager.flowgence.de` (CNAME к Cloudflare; основной домен `flowgence.de` у HostEurope).
- **Worker:** `rezept-manager-ai-proxy` — Gemini API прокси (6 маршрутов `/api/ai/*`)
- **KV:** namespace `RATE_LIMIT_KV` — хранение счётчиков rate limiting

### Google Gemini (AI Studio)

- **Dashboard:** https://aistudio.google.com (личный аккаунт videnejev@gmail.com — Google AI Pro/Ultra, см. `docs/roadmap-archive/decisions-log.md`)
- **Credentials:** запись в пароль-менеджере — «Evgeny's Google Login»
- **Ключ:** Cloudflare secret `GEMINI_API_KEY` — **никогда не в клиентском коде**
- **Модели:**
  - `gemini-3-flash-preview` — import-from-url, import-from-pdf, import-from-photo, calculate-kbzhu, fill-remaining
  - `gemini-2.5-flash-image` — generate-image (aspectRatio 4:3, imageSize 1K)
- **Rate limit:** 10 req/min на IP (счётчик по календарной минуте в Cloudflare KV, не token bucket — допускает всплеск запросов на границе минут). 11-й запрос → 429 + Retry-After.

### GitHub

- **Репозиторий:** https://github.com/katjazhenjaira/Rezept_Manager
- **Credentials:** запись в пароль-менеджере — «GitHub Rezept Manager»

### Регистратор домена (HostEurope)

- **Роль:** основной домен `flowgence.de` (Cloudflare Pages подключён к нему через CNAME на поддомен `rezept-manager.flowgence.de`, см. §5 → Cloudflare)
- **Dashboard:** https://www.hosteurope.de
- **Credentials:** запись в пароль-менеджере — «Host Europe»

---

## 6. Переменные окружения

### Frontend `.env` / `.env.local`

| Переменная                          | Описание                                                                                                                         | Где получить                                              | Кто использует                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------- |
| `VITE_FIREBASE_API_KEY`             | Firebase web API key                                                                                                             | Firebase Console → Project Settings → General → Your apps | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Firebase Auth domain                                                                                                             | Firebase Console                                          | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_PROJECT_ID`          | Firebase project ID (`rezept-manager-62bd0`)                                                                                     | Firebase Console                                          | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Firebase Storage bucket                                                                                                          | Firebase Console                                          | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging sender ID                                                                                               | Firebase Console                                          | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_APP_ID`              | Firebase app ID                                                                                                                  | Firebase Console                                          | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_MEASUREMENT_ID`      | Firebase Analytics ID (опционально)                                                                                              | Firebase Console                                          | `src/infrastructure/firebaseApp.ts` |
| `VITE_AI_WORKER_URL`                | URL Cloudflare Worker. В dev: пусто (Vite proxy `/api → :8787`). В prod: `https://rezept-manager-ai-proxy.<account>.workers.dev` | Cloudflare Dashboard → Workers                            | `src/services/ai/aiClient.ts`       |

Шаблон: `.env.example` в корне.

### Worker `worker/.dev.vars` (локально) / Cloudflare secrets (продакшн)

| Переменная       | Тип        | Описание                                           | Как задать                                                                   |
| ---------------- | ---------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `GEMINI_API_KEY` | Secret     | Google Gemini API ключ                             | Локально: `worker/.dev.vars`. Продакшн: `wrangler secret put GEMINI_API_KEY` |
| `RATE_LIMIT_KV`  | KV binding | Namespace для rate limiting — не строка, а binding | `wrangler.toml` → `kv_namespaces`, создать в Cloudflare Dashboard            |

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
```

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
- `src/infrastructure/testing/` — contract tests для 6 Fake-репозиториев
- `src/infrastructure/firestore/converters.ts` — Timestamp ↔ ISO
- `src/infrastructure/LocalStorageNutritionPlanRepository.ts`
- `src/app/providers/` — DataProvider (4 теста), UserProfileProvider (7 тестов)
- `src/features/auth/` — AuthProvider, LoginScreen, SignupScreen
- `src/features/planner/` — PlannerView smoke tests
- `src/features/tracker/` — TrackerView smoke tests

**Что НЕ покрыто:**

- `worker/` — Cloudflare Worker (требует `@cloudflare/vitest-pool-workers`, TODO в Phase 0b)
- E2E тесты (Playwright не настроен)
- `RecipesView`, `ProgramsView`, `CartView` — только ручное тестирование
- 4 regression flows (allergy check, KBZHU sync, fillRemaining, share-linking) — только ручное

---

## 10. Технические ограничения

| Ограничение                                 | Причина                                                         | Как обойти                                                                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Firestore: не хранить base64-картинки       | Лимит документа ~1 МБ; AI-generated images ~700 КБ+             | Решено (CRIT-1): `resolveImageField()` (`src/infrastructure/firebaseStorage.ts`) грузит `data:` URI в Firebase Storage, в Firestore пишется только URL |
| `GEMINI_API_KEY` только в Cloudflare secret | Безопасность — ключ не должен попасть в клиентский бандл        | Всегда через Worker proxy `/api/ai/*`                                                                                                                  |
| Canvas API недоступен в Cloudflare Worker   | Workers runtime не поддерживает Canvas                          | PDF-операции (`extractImageFromPDF`) только на клиенте через `pdfjs-dist`                                                                              |
| `App.tsx` < 300 строк (не < 200)            | Достигнуто 277; < 200 требует отдельного RecipeSelectionContext | Запланировано как future TODO                                                                                                                          |

---

## 11. Claude Code — окружение для восстановления на новом компьютере

> Этот раздел — не про сам проект, а про AI-ассистированную разработку вокруг него: как воссоздать окружение Claude Code при переезде на новый компьютер. Секреты (API-ключи и т.п.) описаны в §6 — здесь только про настройки инструмента.

Окружение Claude Code для этого проекта состоит из четырёх слоёв.

### 11.1 Установка и вход

Установить Claude Code CLI и войти тем же аккаунтом (`videnejev@gmail.com` / см. §5 — тот же аккаунт, что используется для Firebase и Cloudflare). Вход тем же аккаунтом нужен, чтобы сохранить доступ к account-level MCP-коннекторам claude.ai (Gmail, Google Calendar, Google Drive, Notion, Todoist) — это настройки самого аккаунта claude.ai, локальных файлов для них нет; переустанавливать не нужно, только залогиниться.

### 11.2 Глобальные настройки `~/.claude/settings.json`

Не входит в репозиторий — настройка уровня пользователя, общая для всех проектов. Текущее содержимое (скопировать на новую машину как есть):

```json
{
  "enabledPlugins": {
    "skill-creator@claude-plugins-official": true,
    "context7@claude-plugins-official": true,
    "make-skills@make-marketplace": true,
    "frontend-design@claude-plugins-official": true,
    "superpowers@claude-plugins-official": true,
    "code-review@claude-plugins-official": true,
    "code-simplifier@claude-plugins-official": true,
    "github@claude-plugins-official": true,
    "playwright@claude-plugins-official": true,
    "claude-md-management@claude-plugins-official": true,
    "security-guidance@claude-plugins-official": true
  },
  "extraKnownMarketplaces": {
    "make-marketplace": {
      "source": {
        "source": "github",
        "repo": "integromat/make-skills"
      }
    }
  },
  "language": "Russian",
  "voice": {
    "enabled": true,
    "mode": "hold"
  },
  "theme": "dark-daltonized",
  "voiceEnabled": true
}
```

Плагин `make-skills` устанавливается из стороннего marketplace (`extraKnownMarketplaces`) — без этого блока Claude Code не найдёт его при установке.

### 11.3 Настройки проекта (уже в git — ничего делать не нужно)

Версионируются вместе с репозиторием, переносятся автоматическим `git clone`:

- **`.claude/settings.json`** — определяет Stop-хук, который при прощании пользователя напоминает выполнить Session end protocol из `CLAUDE.md`.
- **`.claude/hooks/session-end-reminder.sh`** — сам хук: парсит последнее сообщение пользователя из transcript (`jq` + `awk`) на прощальные фразы (ru/en) и возвращает напоминание модели через `additionalContext`.

Хук зависит от `bash`, `jq` и `awk` в `PATH` — на macOS/Linux они есть по умолчанию, отдельная установка не нужна (кроме `jq`, если его нет — `brew install jq`).

### 11.4 Локальный allowlist разрешений `.claude/settings.local.json` (не в git)

Файл существует локально в каждом клоне репозитория и содержит накопленный allowlist разрешённых команд (`permissions.allow`) — в основном `npm run *`, `npx wrangler *`, `npx vitest *`, `git add/commit/push *`, набор точечных `curl`/`sqlite3`/`python3` команд, использовавшихся при отладке Worker'а, и MCP-инструменты (Playwright, Context7).

Важный нюанс: этот файл исключён из git **не** через `.gitignore` проекта (там про `.claude` вообще ничего нет), а через **глобальный** `~/.config/git/ignore` на этой машине (строка `**/.claude/settings.local.json`). Это значит:

- На новом компьютере с новым git-конфигом файл не будет автоматически скрыт от `git status`, пока не добавить туда ту же строку (либо перенести домашнюю конфигурацию git целиком).
- Сам список разрешений при переезде проще всего перенести, скопировав файл напрямую со старой машины (`.claude/settings.local.json` в тот же путь на новой). Если старая машина недоступна — ничего страшного: без файла Claude Code будет просто заново спрашивать разрешение на каждую новую команду по мере работы, это не блокер, только вопрос удобства первых сессий.

### 11.5 Кастомный скилл `project-audit`

Используется workflow этого проекта — раздел `## Audit scope` и `## Проработка отчётов аудита` в `CLAUDE.md` описывают, как этот скилл сканирует код и сохраняет отчёты в `docs/audits/`. Скилл живёт на уровне пользователя (`~/.claude/skills/project-audit/SKILL.md`), а не в репозитории — полная копия его содержимого на случай переезда сохранена в `docs/claude-code/project-audit-skill.md`.

Восстановление на новом компьютере:

```bash
mkdir -p ~/.claude/skills/project-audit
cp docs/claude-code/project-audit-skill.md ~/.claude/skills/project-audit/SKILL.md
```

### 11.6 MCP-серверы

В проекте нет `.mcp.json` — MCP-серверы не сконфигурированы на уровне репозитория. Два источника:

- `context7` и `playwright` подключены как **user-level плагины** (см. §11.2 `enabledPlugins`) — восстанавливаются вместе с глобальными настройками.
- Gmail / Google Calendar / Google Drive / Notion / Todoist — **account-level коннекторы claude.ai**, настраиваются в веб-интерфейсе claude.ai (Settings → Connectors), не через локальные файлы. Достаточно быть залогиненным тем же аккаунтом (§11.1).

### 11.7 CLI-инструменты и авторизация

| Инструмент  | Версия / состояние на текущей машине                                    | Что сделать на новой машине                                                                                          |
| ----------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Node        | v24.14.1 (в репозитории не зафиксирована — нет `.nvmrc`/`engines`)       | Установить Node 24.x любым способом (nvm/fnm/Homebrew)                                                                |
| npm         | 11.12.1 (идёт в комплекте с Node)                                        | Устанавливается вместе с Node                                                                                        |
| `wrangler`  | 4.83.0, запускается через `npx`; авторизован OAuth-токеном на аккаунт `rezept-manager@flowgence.de` | `cd worker && npx wrangler login` — пройти OAuth в браузере тем же аккаунтом Cloudflare (credentials — «Cloudflare Rezept-Manager», см. §5) |
| Firebase CLI | **Сознательно не установлен и не используется** — `firestore.rules`/`storage.rules` деплоятся вручную через Firebase Console (см. §10) | Устанавливать не нужно, если не меняется процесс деплоя правил                                                       |
| git + GitHub | Remote по HTTPS: `https://github.com/katjazhenjaira/Rezept_Manager`; локально авторизация через `credential.helper=osxkeychain` | Настроить git-авторизацию заново: SSH-ключ либо HTTPS + `gh auth login` / Personal Access Token (credentials — «GitHub Rezept Manager», см. §5; токен/ключ сохранится в Keychain на macOS) |

### 11.8 Memory Claude Code (опционально)

Claude Code хранит накопленную для этого проекта память (предпочтения, факты о проекте, обратную связь) в `~/.claude/projects/-Users-evidenee-Flowgence-Rezept-Manager/memory/` — путь производится от **абсолютного пути** проекта. Если проект на новой машине клонируется в тот же путь (`/Users/evidenee/Flowgence/Rezept_Manager`), эта директория при переносе подхватится автоматически.

Рекомендация: перед списанием старой машины скопировать эту директорию (и файл `MEMORY.md` внутри неё) на новую по тому же пути — иначе Claude Code начнёт накапливать память с нуля.
