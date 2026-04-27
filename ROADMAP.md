# Recipe Manager — Roadmap

> Live plan for the refactoring and migration effort. Updated each session by Claude and committed together with code changes.

---

## Текущий статус

- **Активная фаза:** Phase 1 — разбор монолита (в работе, Phase 1a + 1b завершены)
- **Следующий шаг:** Phase 1 Step 3a — Providers и Shell (RepositoryProvider, DataProvider, UserProfileProvider, Shell, TabBar, activeNutritionPlan → Firestore)
- **Обновлено:** 2026-04-27
- **Blocker:** нет

---

## Финальная цель

Превратить Recipe Manager из монолитного прототипа (`App.tsx` на 7500 строк) в модульную feature-based архитектуру, готовую к масштабу десятков тысяч пользователей и тысяч консультантов:

1. **Безопасность.** Gemini API-ключ — только на сервере. Firebase/Supabase — только через Auth и Security Rules/RLS.
2. **Модульность.** 6 вкладок — 6 независимых feature-модулей. Shared-доменная логика (КБЖУ, аллергии) — в `shared/domain/`.
3. **Абстракция БД.** Repository-паттерн позволяет переключить Firebase на Supabase одной строкой в `main.tsx`.
4. **Тесты.** Vitest с первого дня, 100% покрытие `shared/domain/`, critical flow tests на allergy check и KBZHU sync.
5. **Целевой стек:** React 19 + Vite + TypeScript strict + Cloudflare Pages + Cloudflare Workers (Gemini proxy) + Supabase (DB + Auth + Realtime) + react-i18next.

---

## Стратегические решения (2026-04-17)

| Вопрос | Выбор | Почему |
|--------|-------|--------|
| Supabase vs Firebase long-term | **Supabase** (Phase 3) | Postgres + RLS подходит для multi-tenant сценария «консультант → клиенты»; биллинг за чтения дешевле на масштабе |
| Хостинг | **Cloudflare остаётся** | Free tier щедрее Vercel (unlimited bandwidth, 100k Worker req/day) |
| Next.js | **Отложен** | App-like приложение, SSR не работает с real-time; вернёмся только при SEO-потребности |
| Auth timing | **До миграции Supabase** (Phase 2, Firebase Auth) | Избегаем периода «открытая БД без Auth»; потом мигрируем user_id в Supabase |
| Phase 1 extras | **Vitest + i18n сразу** | Тесты страхуют рефакторинг; i18n дешевле ввести при разбиении, чем ретрофитить |
| better-sqlite3, dotenv | **Удалить** | Не используются, offline-режим не в приоритете |

---

## Фазы

### Phase 0a — security hygiene (0.5 дня)

**Статус:** [x] завершено (2026-04-19)

- [x] Firebase config → env (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_*`)
- [x] `src/firebase.ts` → `src/infrastructure/firebaseApp.ts`
- [x] `tsconfig.json`: alias `@/*` → `./src/*`, добавить `"strict": true`, `"noUncheckedIndexedAccess": true`
- [x] Починить ошибки, которые вскроет strict mode (23 фикса без TODO — см. журнал решений)
- [x] Удалить `better-sqlite3`, `dotenv` из `package.json`
- [x] Обновить `.env.example`

**Критерий готовности:**
- `npm run build` — зелёный
- `npm run lint` (tsc --noEmit) — 0 ошибок
- `git grep -n 'AIza\|firebaseapp.com'` в `src/` — 0 совпадений (конфиг только в .env)

---

### Phase 0b — Gemini proxy на Cloudflare Worker (3–5 дней)

**Статус:** [ ] в работе (4/6 роутов)

- [x] Подтянуть актуальную документацию через context7: Wrangler, `@google/genai`, Hono
- [x] Скаффолдинг `worker/` с `wrangler.toml`
- [x] 6 routes: ~~`generate-image`~~ ✅, ~~`calculate-kbzhu`~~ ✅, ~~`import-from-url`~~ ✅, ~~`import-from-pdf`~~ ✅, ~~`import-from-photo`~~ ✅, ~~`fill-remaining`~~ ✅
- [x] Shared contracts: `src/services/ai/contracts.ts` (импортируется Worker-ом)
- [x] Клиент: `src/services/ai/aiClient.ts`
- [x] Rate limiting (token bucket в Cloudflare KV, 10 req/min для import-операций)
- [x] Переписать 6 вызовов `new GoogleGenAI()` в `App.tsx` на `aiClient.*` — все 6 удалены
- [x] Vite dev: `wrangler dev` на :8787, Vite proxy `/api → :8787`
- [x] Убрать `define: { 'process.env.GEMINI_API_KEY' }` из `vite.config.ts`
- [x] Cloudflare secret `GEMINI_API_KEY` в Worker
- [x] `aiClient.ts`: `API_BASE` использует `VITE_AI_WORKER_URL` для продакшена
- [x] Деплой Worker на Cloudflare
- [x] Деплой Pages на Cloudflare + кастомный домен `rezept-manager.flowgence.de`
- [x] Запустить security-review skill
- [x] **TODO (code review):** Унифицировать image generation в App.tsx — PDF handler вызывает `aiClient.generateImage()` напрямую, а ручное добавление и import-from-url идут через wrapper `generateRecipeImage`. Удалить wrapper, везде использовать `aiClient.generateImage()`.
- [x] **TODO (code review):** Ужесточить prompt для `import-from-pdf` — заменить "provide the 'pageNumber'..." на "MUST include 'pageNumber' and 'dishBoundingBox' for every recipe" чтобы Gemini не пропускал координаты.
- [ ] **TODO (known issue):** Firestore отклоняет рецепты с base64-картинкой > 1 МБ. Правильный фикс — хранить изображения в Cloudflare R2 (или Firebase Storage) и писать в Firestore только URL. Планируется в Phase 1 или отдельным хот-фиксом.
- [ ] **TODO (code review, Phase 1):** Устранить двойной fetch source page в `import-from-url` — Gemini уже фетчит страницу через `urlContext`, worker фетчит её повторно для og:image. Решение: добавить поле `rawOgImage` в response schema и просить Gemini вернуть значение og:image напрямую.
- [ ] **TODO (code review, Phase 1):** Добавить unit-тесты для `worker/src/middleware/rateLimit.ts` через `@cloudflare/vitest-pool-workers` — покрыть: count=9 (pass), count=10 (429 + Retry-After), corrupted KV value (NaN guard), minute-boundary reset.

**Критерий готовности:**
- `grep -r GEMINI_API_KEY dist/` → 0 совпадений
- Все 6 AI-фич вручную работают через прокси
- Rate limit: 11-й запрос/мин возвращает 429

---

### Phase 1 — разбор монолита (6–10 недель)

**Статус:** [ ] в работе (Phase 1a + 1b завершены)

**1. Доменный слой (до UI):** ✅ Phase 1a завершена (2026-04-26)
- [x] `src/shared/domain/types.ts` — все типы из `App.tsx:163-275`
- [x] `src/shared/domain/macros.ts` — sumMacros, remainingMacros, resolveActiveTargets
- [x] `src/shared/domain/allergies.ts` — recipeAllergens, recipeHasAllergens
- [x] `src/features/cart/services/staples.ts` — BASIC_KEYWORDS, isStaple
- [x] Vitest + тесты 100% покрытия на вышеперечисленное (32 теста, 3 файла)

**2. Сервисный слой:** ✅ Phase 1b завершена (2026-04-27)
- [x] Заменить все 3 вхождения `BASIC_KEYWORDS` в `App.tsx` на `isStaple()` из `src/features/cart/services/staples.ts`
- [x] Repository-интерфейсы: `services/RecipesRepository.ts`, PlannerRepository, ProgramsRepository, CartRepository, UserProfileRepository, NutritionPlanRepository
- [x] Firestore-реализации в `src/infrastructure/firestore/`
- [x] `src/infrastructure/firestore/converters.ts` (Timestamp ↔ ISO)
- [x] Тесты на репозитории с fake (in-memory) реализациями (86 тестов, 0 ошибок TS)

**3a. Providers и Shell:**
- [ ] `src/app/providers/RepositoryProvider.tsx` — инъекция Firestore-реализаций через Context
- [ ] `src/app/providers/DataProvider.tsx` — подписка на репозитории, provides recipes/planner/cart/programs
- [ ] `src/app/providers/UserProfileProvider.tsx` — профиль + activeNutritionPlan
- [ ] `src/app/layout/Shell.tsx` — основной layout (header, content area, tab bar)
- [ ] `src/app/layout/TabBar.tsx` — навигация по 5 вкладкам
- [ ] Перенос `activeNutritionPlan` из localStorage в Firestore `settings/profile`
- [ ] Обновить `main.tsx` — обернуть App провайдерами
- [ ] Тесты провайдеров с fake-репозиториями

**3b. i18n:**
- [ ] `npm install i18next react-i18next`
- [ ] `src/app/providers/I18nProvider.tsx`
- [ ] `src/locales/ru.json`, `de.json`, `en.json` — начальный набор ключей (все хардкоженные строки Shell/TabBar + критические UI-строки)
- [ ] Переключатель языка в Settings (ru/de/en)
- [ ] Все строки в Shell.tsx и TabBar.tsx через `t()` хук

**4. По одной вкладке (от простого к сложному):**
- [ ] Settings
- [ ] Cart
- [ ] Recipes (с 5 методами импорта)
- [ ] Programs (иерархия subfolders)
- [ ] Planner (calendar day/week/month)
- [ ] Tracker (KBZHU + AI suggestions)

**5. Финальная очистка:**
- [ ] `App.tsx` → < 200 строк
- [ ] Удалить inline render-функции
- [ ] `npm run lint` зелёный со strict

**Критерий готовности (DoD):**
- `wc -l src/App.tsx` < 200
- `grep -r "firebase/firestore" src/features src/shared src/app` → 0
- `grep -r "BASIC_KEYWORDS" src/` → 1 match
- Vitest: 50+ тестов на shared/domain, 10+ на репозитории, 5+ на critical flows
- 4 regression flows проходят: allergy check, KBZHU sync, fillRemaining, share-linking
- Mobile viewport обход 6 вкладок — без визуальных регрессий
- Переключение ru/de/en работает на всех вкладках

---

### Phase 2 — Firebase Auth + Security Rules (1–2 недели)

**Статус:** [ ] не начата

- [ ] Включить Firebase Auth (email/password + Google OAuth)
- [ ] `src/features/auth/LoginScreen.tsx`, `SignupScreen.tsx`
- [ ] `src/infrastructure/firebaseAuth.ts`, `useAuth()` hook
- [ ] Миграционный скрипт: `scripts/migrate-assign-user.ts` — все существующие документы получают `userId = <твой uid>`
- [ ] Добавить `userId` в типы и во все writes
- [ ] Обновить все `*.firestore.ts`: фильтр `where('userId', '==', auth.uid())`
- [ ] `firestore.rules` с `request.auth.uid == resource.data.userId`
- [ ] Публичные программы: поле `isPublic`, отдельное правило
- [ ] Logged-out landing + `/login` UX
- [ ] Повторный security-review

**Критерий готовности:**
- Firebase Rules Playground: неаутентифицированное чтение recipes → denied
- Новый юзер видит пустое приложение (не чужие данные)
- `?programId=` публичной программы работает без логина

---

### Phase 3 — миграция на Supabase (3–4 недели)

**Статус:** [ ] не начата

- [ ] Создать Supabase-проект, настроить Auth (email + Google OAuth)
- [ ] Спроектировать схему (`supabase/migrations/*.sql`):
  - `user_profiles`, `recipes`, `planner_entries`, `cart_items`, `programs`, `program_subfolders`, `program_recipes` (junction), `program_resources` (или JSONB)
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
  - правильный порядок: users → profiles → recipes → programs → subfolders → planner_entries → cart_items
  - backward-compat passthrough для pdfUrl/link полей в programs
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

Возвращаемся к этому вопросу только если появилась конкретная SEO-потребность (публичные share-страницы программ должны индексироваться в Google). Альтернатива — отдельная static HTML страница для share-view без переезда всего приложения.

---

### Phase 5 — collaboration & premium (по необходимости)

- Shared programs с тонкими permissions (not just public/private)
- Консультант ↔ клиент dashboards
- Premium tier, биллинг
- Offline режим (IndexedDB в репозиториях)

---

## Журнал решений

- **2026-04-17** — Supabase выбран для Phase 3 (обоснование: multi-tenant масштаб + стоимость).
- **2026-04-17** — Cloudflare остаётся хостингом (вместо планировавшегося Vercel): free tier выгоднее для Vite-приложения без SSR. Gemini proxy делаем на Cloudflare Workers, не на Vercel Functions.
- **2026-04-17** — Next.js миграция отложена до появления реальной SEO-потребности.
- **2026-04-17** — Auth вводится в Phase 2 на Firebase (до переезда в Supabase), чтобы избежать периода «БД без Auth».
- **2026-04-17** — Repository pattern закладывается в Phase 1 (не отдельная фаза), чтобы избежать двойной работы.
- **2026-04-17** — Vitest и react-i18next включены в scope Phase 1 (не отдельные фазы).
- **2026-04-17** — `CLAUDE.md` упрощён: удалены дубли Application_description.md (Feature Map по 6 вкладкам), устаревшая Repository Structure, Current Development Status, Notes & Decisions Log. Остались tech stack, safety-critical constraints, development conventions, session start/end protocols.
- **2026-04-17** — добавлена инфраструктура persistence между сессиями: `ROADMAP.md` как single source of truth для статуса, memory-записи `project_roadmap.md` и `project_session_end.md`, Stop hook в `.claude/settings.json` + `.claude/hooks/session-end-reminder.sh` — автоматически инжектит reminder про Session end protocol, когда пользователь прощается (паттерны RU+EN).
- **2026-04-19** — Phase 0a завершена. Firebase config вынесен в `VITE_FIREBASE_*` env, `src/firebase.ts` переехал в `src/infrastructure/firebaseApp.ts`, включён TS strict + `noUncheckedIndexedAccess`. Strict-mode вскрыл 23 ошибки в `App.tsx` — все починены без TODO/any: `getRecipeById` теперь принимает `string | undefined`, добавлены guard-ы на Gemini `response.text` и `response.candidates?.[0]?.content?.parts`, `ingredientMap[key]` кеширован в локальную переменную (устранило 9 ошибок в shopping-list блоке одним рефакторингом). Установлены `@types/react`/`@types/react-dom`, удалены неиспользуемые `better-sqlite3` и `dotenv`. `.playwright-mcp/` добавлен в `.gitignore`.
- **2026-04-19** — Phase 0b слайс 1 готов: скаффолдинг `worker/` (Hono + wrangler.toml на порту 8787, compatibility_date 2026-04-19, `@cloudflare/workers-types`, strict tsconfig), 6 POST stub-роутов с CORS и глобальным onError. Общие DTO для всех 6 фич — в `src/services/ai/contracts.ts` (импортируется и клиентом, и воркером через `include` в worker/tsconfig.json). Клиент — `src/services/ai/aiClient.ts` с типизированным POST-враппером. Vite dev proxy `/api → http://localhost:8787`. Root tsconfig теперь явно `exclude: worker/**`. Секреты воркера — в `worker/.dev.vars` локально (в .gitignore) и через `wrangler secret put` в проде.
- **2026-04-19** — Phase 0b слайс 2: роут 1 из 6 (`generate-image`) перенесён на воркер. Портирован промпт и конфиг модели (`gemini-2.5-flash-image`, aspectRatio 4:3, imageSize 1K), клиентская функция `generateRecipeImage` теперь — тонкая обёртка над `aiClient.generateImage`, 4 call-site не тронуты. Воркер ответил 200 OK за ~7 сек через Vite proxy, реальный data-URI от Gemini приехал на клиент.
- **2026-04-19** — Known issue обнаружен при e2e-тесте generate-image: **Firestore отклоняет рецепт с AI-картинкой в base64**, т.к. property `image` превышает лимит 1 048 487 байт. Это **НЕ регрессия** от переноса на воркер — старый клиентский код возвращал идентичный oversized data-URI, просто путь «ручное создание рецепта без собственной картинки» раньше не тестировался. **Решение отложено:** правильный фикс — заливать картинки в Cloudflare R2 (или Firebase Storage) и хранить URL, а не base64. Планируется в рамках Phase 1 (repository refactor) или отдельным хот-фиксом раньше при необходимости. Для остальных 5 AI-роутов (импорты + добор КБЖУ + расчёт КБЖУ) эта проблема не возникает — они не возвращают картинки.
- **2026-04-19** — Phase 0b слайсы 3–4: роуты `import-from-url` и `import-from-pdf` портированы на воркер. Ключевые решения: (1) `ImportedRecipe.ingredients/steps` переведены с `string` на `string[]` — Gemini возвращает массивы, App.tsx всегда использовал их как массивы; (2) Добавлено поле `sourceUrl?: string` в `ImportedRecipe`; (3) `generateImageDataUri` вынесен в хелпер `worker/src/helpers/generateImageDataUri.ts` (переиспользуется в `import-from-url` для fallback-изображений); (4) Для PDF `extractImageFromPDF` остаётся на клиенте (Canvas API недоступен в Workers) — клиент извлекает изображение из PDF по `pageNumber`+`dishBoundingBox`, при неудаче вызывает `aiClient.generateImage()`; (5) Все новые воркер-роуты используют try/catch вокруг Gemini + JSON.parse (возвращают 502), валидируют `availableCategories` через `Array.isArray`, применяют case-insensitive category filter с возвратом original-cased значения через `.find()`.
- **2026-04-21** — Phase 0b деплой: Worker задеплоен на Cloudflare с `GEMINI_API_KEY` секретом; Pages задеплоен с кастомным доменом `rezept-manager.flowgence.de` (CNAME у HostEurope, основной домен `flowgence.de` остаётся там). `aiClient.ts` обновлён: `API_BASE` берёт `VITE_AI_WORKER_URL` из env, в dev fallback на `""` (Vite proxy работает как прежде).
- **2026-04-20** — Phase 0b слайсы 5–6: роуты `import-from-photo` и `fill-remaining` портированы на воркер. Все 6 маршрутов активны, `new GoogleGenAI` полностью удалён из `App.tsx`. `FillRemainingOption` в contracts.ts приведён в соответствие с реальным форматом ответа Gemini (поля `id`, `type`, `description` вместо `title`/`portion`/`rationale`). `FillRemainingRequest` дополнен полем `planName`. Для photo-импорта: cropping по `dishBoundingBox` остаётся на клиенте (Canvas API недоступен в Worker); изображение из фото не проходит через воркер, только КБЖУ и метаданные.
- **2026-04-27** — Phase 1b завершена: сервисный слой с Repository pattern. 6 интерфейсов в `src/services/`, 5 Firestore-реализаций в `src/infrastructure/firestore/`, 6 fake in-memory реализаций с contract tests в `src/infrastructure/testing/`, `LocalStorageNutritionPlanRepository.ts`. Конвертер `timestampToISO` с `TimestampLike` структурным типом. `jsdom` добавлен как dev dependency для vitest jsdom-environment тестов. 86 тестов, 0 TS-ошибок. Ключевые дизайн-решения: defensive copy в emit(), emit only on actual mutation (before/after length guard), `value == null` guard вместо `!value` для timestampToISO, `deleteAll` через fresh getDocs (не кеш).
- **2026-04-26** — Phase 1a завершена: доменный слой (types, macros, allergies, staples) вынесен из монолита в `src/shared/domain/` и `src/features/cart/services/`. Vitest 4.x с v8 coverage настроен, 32 теста, 100% покрытие всех новых файлов. App.tsx не тронут — дублирование типов временное, устраняется в Phase 1b. В процессе обнаружено: `BASIC_KEYWORDS` встречается в App.tsx **3 раза** (строки 593, 1946, 3481), а не 2 как планировалось — Phase 1b должна заменить все три вхождения. `vitest.config.ts` получил `exclude: ['**/.worktrees/**']` для корректного поведения при работе с git worktrees.
- **2026-04-19** — Phase 0b слайс 2: роут 2 из 6 (`calculate-kbzhu`) перенесён на воркер. Модель и схема ответа сохранены 1-в-1 (`gemini-3-flash-preview`, responseSchema с calories/proteins/fats/carbs). `CalculateKbzhuRequest` упрощён до `{ ingredients: string }` — прежний черновик типа `{ title, ingredients: string[], servings }` не соответствовал реальному call-site (форма передаёт сырую строку). Проверено курлом и в браузере (200 OK, КБЖУ заполнилось корректно). Также добавлен `server.watch.ignored` в `vite.config.ts` для `.claude/`, `.playwright-mcp/`, `worker/` — без этого Claude Code писал `settings.local.json` каждые несколько секунд, и Vite reload-ил страницу, ломая browser-тесты модалок.

---

## Протокол работы над этим roadmap'ом

В начале каждой сессии Claude:
1. Читает этот файл, сверяет раздел «Текущий статус».
2. Одним предложением пересказывает пользователю, на какой фазе мы и что следующее.
3. Ждёт подтверждения, что работаем над запланированным шагом (или переключаемся на ad-hoc задачу).

По ходу работы:
1. Отмечает `[x]` в чеклисте текущей фазы по мере завершения подзадач.
2. Коммитит `ROADMAP.md` вместе с кодом того же шага.
3. При значимом решении (выбор библиотеки, изменение архитектуры, обнаружение блокера) добавляет запись в «Журнал решений» с датой.
4. При переходе между фазами обновляет «Текущий статус» и делает отдельный commit для видимой вехи.
