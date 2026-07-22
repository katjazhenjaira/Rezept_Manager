# План тест-покрытия — 2026-07-22

Трекинг-файл выполнения. После каждого пункта — отметка `[x]` с хешем коммита.
Полный контекст решений — см. раздел «Решения» внизу. Выполняется через субагентов
(subagent-driven development): implementer → task review → фикс → отметка здесь.

## WP1 — Инфраструктура тестов worker

- [x] `worker/vitest.config.ts` (node env, coverage v8, include `src/**`, exclude `__tests__`/`types.ts`) — commit `2fe610e`
- [x] `worker/package.json`: devDeps `vitest`, `@vitest/coverage-v8`; скрипты `test`, `test:coverage`; `npm install` — commit `2fe610e`
- [x] Корневой `vitest.config.ts`: `'worker/**'` в `test.exclude` — commit `2fe610e`
- [x] Корневой `package.json`: скрипт `test:worker` — commit `2fe610e` (⚠️ `npm run test:worker` красный до первого теста в WP2 — ожидаемо)

## WP2 — Тесты worker (safety-critical)

- [x] `worker/src/helpers/__tests__/validateExternalUrl.test.ts` (23 теста) — commit `e1b5b29`
- [x] `worker/src/helpers/__tests__/timeout.test.ts` (8) — commit `e1b5b29`
- [x] `worker/src/helpers/__tests__/generateImageDataUri.test.ts` (5) — commit `e1b5b29`
- [x] `worker/src/middleware/__tests__/rateLimit.test.ts` (7) — commit `e1b5b29`
- [x] 🔴 **SSRF-FIX (найдено при написании тестов):** блокировка IPv4-mapped/compatible IPv6 в `validateExternalUrl.ts` была мёртвым кодом (`new URL()` канонизирует в hex-форму). Исправлено в 2 захода: hex-форма `::ffff:HHHH:LLLL` — commit `dfe5e0e`; устаревшая compatible-форма `::HHHH:LLLL` (без `ffff:`) — commit `452d5e6`. Bypass-sweep чист. Нарушение CRIT-5 из CLAUDE.md закрыто
- [x] `worker/src/routes/__tests__/calculateKbzhu.test.ts` — commit `0fe551f`
- [x] `worker/src/routes/__tests__/fillRemaining.test.ts` — commit `0fe551f`
- [x] `worker/src/routes/__tests__/generateImage.test.ts` — commit `0fe551f`
- [x] `worker/src/routes/__tests__/importFromPdf.test.ts` — commit `0fe551f`
- [x] `worker/src/routes/__tests__/importFromPhoto.test.ts` — commit `0fe551f` (гейт base64 покрыт)
- [x] `worker/src/routes/__tests__/importFromUrl.test.ts` — commit `0fe551f` (SSRF-гейт + маппинг категорий)
- [x] `worker/src/__tests__/index.test.ts` — commit `0fe551f` (GET /, onError, CORS, rate limiter)
- Worker suite итог: **118 тестов зелёных**. Для финального ревью: (1) в `generateImageDataUri.ts:29` mimeType захардкожен `image/png` игнорируя `part.inlineData.mimeType` — pre-existing quirk, не баг теста; (2) 3 из 4 validation-веток в `fillRemaining.test.ts` проверяют только status без body — Minor

## WP3 — Тесты фронтенд-логики

- [x] `src/features/recipes/__tests__/useRecipeFilters.test.tsx` (19) — commit `72eba7b` + фикс фикстуры сортировки `0563c1d` (review)
- [x] `src/services/ai/__tests__/aiClient.test.ts` (9) — commit `72eba7b`
- [x] `src/app/providers/__tests__/i18nConfig.test.ts` (3) — commit `72eba7b`
- [x] `src/shared/utils/__tests__/pdfUtils.test.ts` (5) — commit `72eba7b`
- Root suite итог: **160 тестов зелёных**
- [ ] Решение: Firestore*Repository — без прямых тестов (контрактно через Fakes + converters) → зафиксировать в ТехДок §9 (WP6)

## WP4 — UI smoke-тесты (RTL)

- [x] `RecipeCard`, `RecipesView`, `RecipeDetailModal`, `CartView`, `ProgramsView`, `TabBar`, `LandingPage` — 15 smoke-тестов, commit `95848d3`. Root suite итог: **175 тестов**
- Заметки для WP6/финала: `RecipesView`/`ProgramsView` транзитивно тянут `pdfjs-dist` (нужен `DOMMatrix`, нет в jsdom) → мокается `@/shared/utils/pdfUtils` (паттерн как в `AddRecipeModals.test.tsx`). Найдены 2 a11y-замечания в исходниках (не баги тестов, не чинили): favorite-кнопка `RecipeCard` полагается на `stopPropagation` вызывающего; close/favorite в `RecipeDetailModal` — иконки без accessible name
- (2-й приоритет `RecipeFilterSidebar`/`RecipesToolbar`/`SettingsModal` и `App.tsx`/`AuthenticatedApp` — пропущены, тяжёлая обвязка/оркестраторы → в «нетестируемые/manual» docs)

## WP5 — Coverage config

- [x] Корневой `coverage.include` += `useRecipeFilters.ts`, `aiClient.ts`, `pdfUtils.ts` — commit `4c910c1` (coverage прогоняется; pdfUtils 66%, canvas-ветка 24-39 непокрыта как задокументировано)

## WP6 — Technical_Project_Documentation.md §9

- [x] §9 обновлён полностью (команды, 293 теста, worker закрыт, новый подраздел «Нетестируемые сценарии» из 8 пунктов) — commit `771c19f`

## WP7 — Скилл `~/.claude/skills/project-audit/SKILL.md` (вне git!)

- [x] Все 5 правок (frontmatter «10 categories», Phase 3 заголовок + категория `### 10. 🧪 TEST-`, таблица Phase 4, пункт Phase 5) применены к обоим файлам идентично — commit `638d1ba` (repo-копия). Внешний `~/.claude/skills/...` отредактирован, но не в git (вне репозитория) — `diff` подтвердил идентичность
- [x] ТехДок §11.5 — счётчика категорий не содержит, правка не требовалась

## Финал

- [ ] Итоговый code review всей ветки работ
- [ ] `npm test` (корень) + `npm --prefix worker test` + `npm run lint` — всё зелёное

## Решения

- **Worker-тесты — обычный vitest в node env** (не `@cloudflare/vitest-pool-workers`): worker использует только web-standard API (fetch, AbortSignal.timeout, btoa), Workers-глобалов нет, KV фейкается объектом `{get, put}`. Hono `app.request(path, init, env)` принимает мок-биндинги. pool-workers остаётся TODO Phase 0b для интеграционных тестов.
- **Worker-тесты — явные импорты из vitest** (без globals), чтобы не менять `worker/tsconfig.json` (`types: ["@cloudflare/workers-types"]`).
- **Мок `@google/genai`** — через `vi.mock` с `importOriginal`, сохраняя реальный `Type` enum (используется на module scope роутов).
- **Firestore-репозитории** — прямые unit-тесты не пишем: мок поверхности `firebase/firestore` даёт хрупкие «зеркальные» тесты; конверсия покрыта `converters.test.ts`, контракт — тестами Fake-репозиториев.
- **UI-компоненты не включаем в `coverage.include`** — smoke-тесты не coverage-grade.
