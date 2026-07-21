# Recipe Manager — Status

## Активная фаза

Отчёт аудита кода `docs/audits/2026-07-19-project-audit-report.md` полностью закрыт (60/60 находок проработаны). Phase 3 (миграция на Supabase) не начата — теперь ничего не блокирует старт, кроме выбора пользователя, с чего продолжить.

## Следующий шаг

Не выбран явно — на выбор пользователя в следующей сессии:

- Начать **Phase 3** (миграция на Supabase) — детали в `ROADMAP.md`.
- Или сначала разобрать **TODO (code review): `eslint src` (35 errors / 2 warnings)** на существующем коде — см. DOC-14 в `ROADMAP.md`.
- Плюс два открытых остатка из аудита, не привязанных к конкретной фазе (см. `ROADMAP.md` → «Технический долг»): **PERF-2** (`subscribeAll` без `limit()`, отложена — требует решения по пагинации UI) и **PERF-5 остаток** (`PlannerView.tsx` — нужен `PlannerEntryCard` перед `React.memo`).

## Blocker

Нет.

## Обновлено

2026-07-21

---

## Итоги последней сессии

- CONV-1 (декомпозиция `RecipesView.tsx`) завершена: шаги 3-7 из плана (шаги 0-2 были сделаны в предыдущей сессии) — `RecipesView.tsx` 2617 → 333 строки, 7 новых файлов (`RecipesEmptyState`, `RecipeCard`, `useRecipeFilters`, `RecipesToolbar`, `RecipeFilterSidebar`, `AddRecipeModals`, `RecipeDetailModal`) + `scaleMacros()` в `macros.ts` с unit-тестами
- Ручной browser smoke-test (Playwright MCP, реальный тестовый Firebase-аккаунт, credentials от пользователя) — нашёл 2 pre-existing бага, не регрессия рефакторинга, оба зафиксированы в `ROADMAP.md` → «Баги»
- Весь раздел 🐢 Производительность отчёта аудита закрыт: PERF-1, PERF-3, PERF-4, PERF-6, PERF-7, PERF-8 исправлены; PERF-2 осознанно отложена; PERF-5 закрыта частично (только `RecipesView.tsx`)
- **Отчёт аудита кода `docs/audits/2026-07-19-project-audit-report.md` полностью закрыт (60/60)** — весь цикл проработки, начатый 2026-07-19, завершён
- Каждая находка/шаг — отдельный коммит с указанием ID; рефакторинг CONV-1 велся через субагентов по прямому указанию пользователя, PERF-находки — напрямую

## Ключевые решения, влияющие на следующий шаг

- CONV-1 закрыт полностью — декомпозиция `RecipesView.tsx` больше не блокирует ничего в `ROADMAP.md`
- Два новых пункта технического долга в `ROADMAP.md` (не входят в закрытый отчёт, но выросли из него): PERF-2 (пагинация Cart/Recipes/Programs — продуктовое решение) и PERF-5 остаток (`PlannerEntryCard` для `PlannerView.tsx`)
- Три новых пункта в `ROADMAP.md` → «Баги», найдены при смоук-тесте CONV-1 (все — pre-existing, не регрессия)
- Новый паттерн-constraint в `CLAUDE.md` → Known constraints: `render*View()`-функции, вызываемые условно внутри тела компонента, не могут содержать хуки — мемоизация поднимается на уровень компонента (пример: `entriesByDate` в `PlannerView.tsx`)
- Новый паттерн в `CLAUDE.md` → Known constraints: все upstream-вызовы в `worker/` (`generateContent()`/`fetch()`) обязаны иметь `AbortSignal.timeout()` — `helpers/timeout.ts`
- Repository pattern уже реализован — для Supabase нужны только новые реализации интерфейсов из `src/services/`

---

## Где искать контекст

- `ROADMAP.md` — активные + будущие фазы (Phase 3, 4, 5), технический долг (PERF-2, PERF-5 остаток, eslint TODO), известные баги
- `docs/audits/2026-07-19-project-audit-report.md` — отчёт аудита, закрыт полностью (60/60)
- `docs/audits/conv-1-decomposition-plan.md` — план декомпозиции RecipesView.tsx (CONV-1), все шаги [x]
- `Application_description.md` — бизнес-логика (6 вкладок, AI-правила, UX)
- `Technical_Project_Documentation.md` — архитектура, стек, файловая структура, env vars
- `docs/roadmap-archive/` — завершённые фазы (0a, 0b, 1, 2) + журнал решений
- `docs/superpowers/specs/` — спеки фаз
