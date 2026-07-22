# План тест-покрытия — 2026-07-22

Трекинг-файл выполнения. После каждого пункта — отметка `[x]` с хешем коммита.
Полный контекст решений — см. раздел «Решения» внизу. Выполняется через субагентов
(subagent-driven development): implementer → task review → фикс → отметка здесь.

## WP1 — Инфраструктура тестов worker

- [ ] `worker/vitest.config.ts` (node env, coverage v8, include `src/**`, exclude `__tests__`/`types.ts`)
- [ ] `worker/package.json`: devDeps `vitest`, `@vitest/coverage-v8`; скрипты `test`, `test:coverage`; `npm install`
- [ ] Корневой `vitest.config.ts`: `'worker/**'` в `test.exclude`
- [ ] Корневой `package.json`: скрипт `test:worker`

## WP2 — Тесты worker (safety-critical)

- [ ] `worker/src/helpers/__tests__/validateExternalUrl.test.ts` — SSRF-набор: протоколы, localhost/*.local, приватные IPv4/IPv6, IPv4-mapped IPv6, публичные адреса; `safeFetch`: redirect-ревалидация (302 → приватный хост = null), maxRedirects, manual redirect + timeout signal
- [ ] `worker/src/helpers/__tests__/timeout.test.ts` — `isTimeoutError`, `UPSTREAM_TIMEOUT_MS`
- [ ] `worker/src/helpers/__tests__/generateImageDataUri.test.ts` — data-URI / null-ветки
- [ ] `worker/src/middleware/__tests__/rateLimit.test.ts` — fake KV: без IP → пропуск; put(1, ttl 65); инкремент; 429 при ≥10; мусор → 0; X-Forwarded-For; минутные бакеты
- [ ] `worker/src/routes/__tests__/calculateKbzhu.test.ts` — 400-валидация, happy path, 504 timeout, 502 generic
- [ ] `worker/src/routes/__tests__/fillRemaining.test.ts` — то же
- [ ] `worker/src/routes/__tests__/generateImage.test.ts` — то же + 502 при отсутствии inline image
- [ ] `worker/src/routes/__tests__/importFromPdf.test.ts` — то же
- [ ] `worker/src/routes/__tests__/importFromPhoto.test.ts` — то же + гейт размера base64
- [ ] `worker/src/routes/__tests__/importFromUrl.test.ts` — то же + 400 на приватный URL (SSRF-гейт), маппинг категорий
- [ ] `worker/src/__tests__/index.test.ts` — GET /, onError → 500 generic, CORS, rate limiter на /api/ai/*

## WP3 — Тесты фронтенд-логики

- [ ] `src/features/recipes/__tests__/useRecipeFilters.test.tsx` — поиск, favorites, AND-категории, автор/программа, время/калории, сортировки, allAuthors/allPrograms, toggle/reset/hasActiveFilters
- [ ] `src/services/ai/__tests__/aiClient.test.ts` — 6 эндпоинтов, ok-парсинг, ошибка с текстом сервера, fallback statusText
- [ ] `src/app/providers/__tests__/i18nConfig.test.ts` — changeLanguage + localStorage
- [ ] `src/shared/utils/__tests__/pdfUtils.test.ts` — extractTextFromPDF (склейка, ошибки), extractImageFromPDF (graceful-ветки)
- [ ] Решение: Firestore*Repository — без прямых тестов (контрактно через Fakes + converters) → зафиксировать в ТехДок §9 (WP6)

## WP4 — UI smoke-тесты (RTL)

- [ ] `RecipesView` — рендер + поиск фильтрует карточки
- [ ] `RecipeCard` — onSelect / favorite
- [ ] `RecipeDetailModal` — контент + onClose
- [ ] `CartView` — empty state + отметка позиции
- [ ] `ProgramsView` — empty state + открытие детали
- [ ] `TabBar` + `Shell` — переключение вкладок
- [ ] `LandingPage` — smoke
- [ ] (2-й приоритет) `RecipeFilterSidebar`, `RecipesToolbar`, `RecipesEmptyState`, `SettingsModal`
- [ ] `App.tsx`/`AuthenticatedApp` — smoke за FakeAuthProvider, если не тянут firebaseApp; иначе → в «нетестируемые»

## WP5 — Coverage config

- [ ] Корневой `coverage.include` += `useRecipeFilters.ts`, `aiClient.ts`, `pdfUtils.ts`

## WP6 — Technical_Project_Documentation.md §9

- [ ] Исправить `npm run coverage` → `npm run test:coverage`; добавить worker-команду
- [ ] Обновить «Что покрыто» (актуальное число тестов + новые области)
- [ ] Обновить «Что НЕ покрыто» (worker закрыт unit-тестами; pool-workers = TODO Phase 0b)
- [ ] Новый подраздел «Нетестируемые сценарии» с причинами: main.tsx, firebaseApp.ts, рендер/кроп extractImageFromPDF (нет Canvas в jsdom), Firestore*Repository (контрактное покрытие), firestore/storage.rules (нет эмулятора), реальные Gemini-вызовы, Workers-рантайм (KV), полные E2E (Playwright не настроен)

## WP7 — Скилл `~/.claude/skills/project-audit/SKILL.md` (вне git!)

- [ ] Frontmatter: «9 categories» → «10 categories» + «test coverage gaps»
- [ ] Phase 3: заголовок «по 10 категориям» + новая категория `### 10. 🧪 Тестовое покрытие` (ID `TEST-`)
- [ ] Phase 4: строка в сводной таблице
- [ ] Phase 5: пункт про обновление раздела «Тестирование»
- [ ] ТехДок §11.5 — обновить счётчик категорий, если там «9»

## Финал

- [ ] Итоговый code review всей ветки работ
- [ ] `npm test` (корень) + `npm --prefix worker test` + `npm run lint` — всё зелёное

## Решения

- **Worker-тесты — обычный vitest в node env** (не `@cloudflare/vitest-pool-workers`): worker использует только web-standard API (fetch, AbortSignal.timeout, btoa), Workers-глобалов нет, KV фейкается объектом `{get, put}`. Hono `app.request(path, init, env)` принимает мок-биндинги. pool-workers остаётся TODO Phase 0b для интеграционных тестов.
- **Worker-тесты — явные импорты из vitest** (без globals), чтобы не менять `worker/tsconfig.json` (`types: ["@cloudflare/workers-types"]`).
- **Мок `@google/genai`** — через `vi.mock` с `importOriginal`, сохраняя реальный `Type` enum (используется на module scope роутов).
- **Firestore-репозитории** — прямые unit-тесты не пишем: мок поверхности `firebase/firestore` даёт хрупкие «зеркальные» тесты; конверсия покрыта `converters.test.ts`, контракт — тестами Fake-репозиториев.
- **UI-компоненты не включаем в `coverage.include`** — smoke-тесты не coverage-grade.
