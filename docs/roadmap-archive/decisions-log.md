# Журнал архитектурных решений

Хронологический лог значимых решений по проекту Recipe Manager.

---

- **2026-04-17** — Supabase выбран для Phase 3 (обоснование: multi-tenant масштаб + стоимость).
- **2026-04-17** — Cloudflare остаётся хостингом (вместо Vercel): free tier выгоднее для Vite-приложения без SSR. Gemini proxy на Cloudflare Workers.
- **2026-04-17** — Next.js миграция отложена до появления реальной SEO-потребности.
- **2026-04-17** — Auth вводится в Phase 2 на Firebase (до переезда в Supabase), чтобы избежать периода «БД без Auth».
- **2026-04-17** — Repository pattern закладывается в Phase 1 (не отдельная фаза).
- **2026-04-17** — Vitest и react-i18next включены в scope Phase 1 (не отдельные фазы).
- **2026-04-17** — `CLAUDE.md` упрощён: удалены дубли Application_description.md, устаревшая структура. Добавлена инфраструктура persistence: `ROADMAP.md`, memory-записи, Stop hook.
- **2026-04-19** — Phase 0a: Firebase config → env, `src/firebase.ts` → `src/infrastructure/firebaseApp.ts`, TS strict + `noUncheckedIndexedAccess`. 23 ошибки починены без TODO/any. `.playwright-mcp/` в `.gitignore`.
- **2026-04-19** — Phase 0b слайс 1: скаффолдинг `worker/` (Hono, wrangler.toml, порт 8787). DTO в `src/services/ai/contracts.ts`. Клиент `src/services/ai/aiClient.ts`. Vite proxy `/api → :8787`.
- **2026-04-19** — Phase 0b слайс 2 (`generate-image`): Known issue — **Firestore отклоняет рецепт с base64 AI-картинкой** (>1 МБ). Решение отложено: Cloudflare R2 / Firebase Storage.
- **2026-04-19** — Phase 0b слайсы 3–4: `ingredients/steps` → `string[]`; `sourceUrl?` в `ImportedRecipe`; `generateImageDataUri` → хелпер; `extractImageFromPDF` остаётся на клиенте (Canvas API недоступен в Workers).
- **2026-04-20** — Phase 0b слайсы 5–6: все 6 маршрутов активны. `FillRemainingOption`: поля `id`, `type`, `description`.
- **2026-04-21** — Phase 0b деплой: Worker на Cloudflare; Pages с доменом `rezept-manager.flowgence.de` (CNAME у HostEurope).
- **2026-04-26** — Phase 1a: доменный слой в `src/shared/domain/`. Vitest 4.x, 32 теста. `BASIC_KEYWORDS` в App.tsx 3 раза (не 2).
- **2026-04-27** — Phase 1b: Repository pattern. 6 интерфейсов, 5 Firestore-реализаций, 6 fake in-memory. 86 тестов.
- **2026-04-27** — Phase 1 Step 3a: провайдеры и Shell. `activeNutritionPlan` → Firestore `settings/plan`. 97 тестов.
- **2026-04-28** — Phase 1 Step 4 (Cart + Recipes): `selectedRecipe`, `isAddingManual/Link/PDF` подняты как controlled props в App.tsx. App.tsx: 6753 → 4538 строк.
- **2026-04-30** — Phase 1 Step 4 (Programs): App.tsx: 4538 → 2482 строк. `photoInputRef` тип → `RefObject<HTMLInputElement | null>` для React 19.
- **2026-07-18** — Phase 1 Step 4 (Planner): App.tsx: 2482 → 1395 строк. `mealTypes` остался в App.tsx; prop `onNavigateToCart` вместо `setActiveTab('cart')`.
- **2026-07-18** — Phase 1 Step 4 (Tracker): App.tsx: 1395 → 540 строк. `handleAddSelectedSuggestions` дедуплицирован.
- **2026-07-18** — Phase 1 Step 5: App.tsx: 540 → 277 строк. `pdfUtils.ts` — одна canonical copy. `useEffect` в SettingsModal гейтирован по `isOpen`.
- **2026-07-19** — Phase 2: 112 тестов. AuthProvider рендерит children во время loading; `AuthenticatedApp` guard `if (loading || !user) return null`.
- **2026-07-19** — Phase 1 DoD закрыт: `firebase/firestore` убран из всех feature-файлов → `useRepositories()`. `DEFAULT_PROFILE` → `src/shared/domain/defaults.ts`.
- **2026-07-19** — Security review Phase 2: HIGH-уязвимость userId-overwrite. Исправлено: `request.resource.data.userId == resource.data.userId` (commit `aecde4a`).
- **2026-07-19** — Firebase-проект сменён с `mein-app-25e08` на `rezept-manager-62bd0` (личный аккаунт videnejev@gmail.com).
- **2026-07-19** — Реструктуризация документации: STATUS.md, docs/roadmap-archive/, Technical_Project_Documentation.md. CLAUDE.md обновлён.
- **2026-07-19** — Полный аудит кода (`project-audit`): 60 находок по 9 категориям, отчёт в `docs/audits/2026-07-19-project-audit-report.md`. `ROADMAP.md`: разделы «Технический долг» и «Баги» (нерабочий импорт по ссылке, не диагностирован). `CLAUDE.md`: правило проработки отчётов аудита (по одной находке, коммит + отметка в отчёте на каждую).
- **2026-07-19** — CRIT-1 закрыт: base64-картинки (known issue с 0b слайса 2) больше не пишутся в Firestore. Решение — не R2, а Firebase Storage через единую точку перехвата на уровне репозитория (`resolveImageField()` в `FirestoreRecipesRepository`/`FirestoreProgramsRepository`), а не точечные guard'ы в UI. `storage.rules` деплоится вручную через Firebase Console (CLI не настроен, как и для `firestore.rules`). Подтверждено вручную — загрузка картинки работает, файлы в Storage.
- **2026-07-19** — CRIT-2/CRIT-3 закрыты: allergy-check (8 мест) и КБЖУ-суммирование (7 мест) дедуплицированы на `recipeAllergens`/`recipeHasAllergens`/`sumMacros`/`remainingMacros`/`resolveActiveTargets` из `src/shared/domain/`.
