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

| Слой | Технология | Версия | Роль |
|------|-----------|--------|------|
| Frontend | React | 19.0 | UI |
| Language | TypeScript | 5.8 strict | Типизация |
| Build | Vite | 6.2 | Bundler + dev server |
| Styles | Tailwind CSS | 4.1 | Утилитарные стили |
| State | Context API + Repository pattern | — | Нет внешней state lib |
| DB/Backend | Firebase (Firestore + Auth) | 12.9 | Текущий бэкенд (→ Supabase в Phase 3) |
| AI | Google Gemini via Cloudflare Worker | @google/genai 1.29 | Импорт рецептов, КБЖУ, AI-советы |
| Worker | Hono на Cloudflare Workers | — | Gemini proxy, rate limiting |
| i18n | i18next + react-i18next | 26 / 17 | ru/de/en |
| Icons | lucide-react | 0.546 | UI иконки |
| Animation | motion (framer-motion) | — | Анимации |
| Dates | date-fns | 4.1 | Работа с датами |
| PDF | pdfjs-dist | — | Клиентский парсинг PDF (Canvas нужен) |
| Testing | Vitest + @testing-library/react | 4.1 | 112 тестов |
| Hosting | Cloudflare Pages + Workers | — | Фронтенд + AI proxy |

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
| `firebaseApp.ts` | Firebase app singleton (Firestore, Auth, Storage) |
| `firebaseAuth.ts` | Firebase Auth singleton |
| `firebaseStorage.ts` | `resolveImageField()` — загрузка base64 data URI в Firebase Storage (`users/{uid}/{folder}/`), возвращает Storage URL; используется репозиториями Recipes/Programs перед записью в Firestore (CRIT-1, `docs/audits/2026-07-19-project-audit-report.md`) |
| `firestore/FirestoreRecipesRepository.ts` | Реализация, uid-scoped, userId в writes, image-поле прогоняется через `resolveImageField()` |
| `firestore/FirestorePlannerRepository.ts` | То же для planner |
| `firestore/FirestoreCartRepository.ts` | То же для cart |
| `firestore/FirestoreProgramsRepository.ts` | То же для programs; image и subfolders[].image прогоняются через `resolveImageField()` |
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
- **Dashboard:** console.firebase.google.com → проект `rezept-manager-62bd0`
- **Firestore:** данные пользователей — коллекции `recipes`, `planner`, `cart`, `programs`, `userProfiles`, `nutritionPlans`. Все uid-scoped (`where('userId', '==', uid)`).
- **Auth:** email/password (Google OAuth — Phase 2b, не реализован)
- **Security Rules:** `firestore.rules` — `request.auth.uid == resource.data.userId`, userId immutable при update
- **Storage:** бакет `VITE_FIREBASE_STORAGE_BUCKET`, пути `users/{uid}/{recipeImages|programImages|subfolderImages}/{fileId}`. AI-generated/загруженные base64-изображения рецептов и программ хранятся здесь (не в Firestore) — см. `src/infrastructure/firebaseStorage.ts`. **Security Rules:** `storage.rules` — uid-scoped, лимит 5MB, только `image/*`. Деплоится вручную через Firebase Console → Storage → Rules (как и `firestore.rules`, CLI не настроен).

### Cloudflare
- **Аккаунт:** связан с videnejev@gmail.com
- **Dashboard:** dash.cloudflare.com
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
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | Firebase Console | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID (`rezept-manager-62bd0`) | Firebase Console | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket | Firebase Console | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Cloud Messaging sender ID | Firebase Console | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | Firebase Console | `src/infrastructure/firebaseApp.ts` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Analytics ID (опционально) | Firebase Console | `src/infrastructure/firebaseApp.ts` |
| `VITE_AI_WORKER_URL` | URL Cloudflare Worker. В dev: пусто (Vite proxy `/api → :8787`). В prod: `https://rezept-manager-ai-proxy.<account>.workers.dev` | Cloudflare Dashboard → Workers | `src/services/ai/aiClient.ts` |

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

| Ограничение | Причина | Как обойти |
|------------|---------|-----------|
| Firestore: не хранить base64-картинки | Лимит документа ~1 МБ; AI-generated images ~700 КБ+ | Cloudflare R2 / Firebase Storage → писать только URL в Firestore (Phase 1 TODO) |
| `GEMINI_API_KEY` только в Cloudflare secret | Безопасность — ключ не должен попасть в клиентский бандл | Всегда через Worker proxy `/api/ai/*` |
| Canvas API недоступен в Cloudflare Worker | Workers runtime не поддерживает Canvas | PDF-операции (`extractImageFromPDF`) только на клиенте через `pdfjs-dist` |
| `App.tsx` < 300 строк (не < 200) | Достигнуто 277; < 200 требует отдельного RecipeSelectionContext | Запланировано как future TODO |
| AppHeader: язык меняется только визуально | `changeLanguage()` i18n не вызывается | Подключить i18n или убрать переключатель из хедера (future TODO) |
