# Recipe Manager — Status

## Активная фаза

Отчёт аудита кода `docs/audits/2026-07-19-project-audit-report.md` полностью закрыт (60/60 находок проработаны). TODO по разбору `eslint src` (DOC-14) тоже закрыт. Phase 3 (миграция на Supabase) не начата — ничего не блокирует старт, кроме выбора пользователя, с чего продолжить.

## Следующий шаг

Не выбран явно — на выбор пользователя в следующей сессии:

- Начать **Phase 3** (миграция на Supabase) — детали в `ROADMAP.md`.
- Или **PERF-2** (`subscribeAll` без `limit()`, отложена — требует решения по пагинации UI) — см. `ROADMAP.md` → «Технический долг».
- Или **PERF-5 остаток** (`PlannerView.tsx` — нужен `PlannerEntryCard` перед `React.memo`) — см. `ROADMAP.md` → «Технический долг».

## Blocker

Нет.

## Обновлено

2026-07-21

---

## Итоги последней сессии

- Разобраны все находки `eslint src` (DOC-14, отложенный пункт техдолга из отчёта аудита 2026-07-19): 28 находок на момент разбора (изначально зафиксировано 35 errors/2 warnings — часть устранилась в ходе CONV-1/PERF-рефакторингов предыдущей сессии)
- Группировка — по файлу (решение пользователя): 9 коммитов на `App.tsx`, `I18nProvider.tsx`+`i18nConfig.ts` (новый файл), `PlannerView.tsx`+тест, `ProgramDetailModal.tsx`, `SettingsModal.tsx`, `ProgramSelectionModal.tsx`, `TrackerView.test.tsx`, `main.tsx`+`AuthenticatedApp.tsx` (новый файл)
- После каждого коммита: `eslint <file>`, `tsc --noEmit`, `vitest run` (122/122 зелёных на протяжении всей сессии), финально ещё и `npm run build`
- `eslint src` теперь полностью чист (0 находок)
- `ROADMAP.md` → «Технический долг»: пункт DOC-14/eslint отмечен `[x]`
- `CLAUDE.md` → Known constraints: зафиксирован паттерн для `react-hooks/set-state-in-effect` — намеренные эффекты (deep-link редирект, sync/reset формы по `isOpen`) помечать `eslint-disable` с обоснованием, а не рефакторить вслепую; настоящие mount-only инициализации переносить в lazy `useState`-initializer

## Ключевые решения, влияющие на следующий шаг

- DOC-14 закрыт полностью — раздел «Технический долг» `ROADMAP.md` сократился до PERF-2 и PERF-5 остатка (плюс сам Phase 3)
- Новый паттерн-constraint в `CLAUDE.md` → Known constraints: `react-hooks/set-state-in-effect` — см. выше
- `main.tsx` теперь чистая точка входа без определения компонентов (вынесено в `src/app/AuthenticatedApp.tsx`)
- `i18nConfig.ts` — новый файл с i18n-инициализацией и `changeLanguage()`, отделён от компонента `I18nProvider`

---

## Где искать контекст

- `ROADMAP.md` — активные + будущие фазы (Phase 3, 4, 5), технический долг (PERF-2, PERF-5 остаток), известные баги
- `docs/audits/2026-07-19-project-audit-report.md` — отчёт аудита, закрыт полностью (60/60)
- `docs/audits/conv-1-decomposition-plan.md` — план декомпозиции RecipesView.tsx (CONV-1), все шаги [x]
- `Application_description.md` — бизнес-логика (6 вкладок, AI-правила, UX)
- `Technical_Project_Documentation.md` — архитектура, стек, файловая структура, env vars
- `docs/roadmap-archive/` — завершённые фазы (0a, 0b, 1, 2) + журнал решений
- `docs/superpowers/specs/` — спеки фаз
