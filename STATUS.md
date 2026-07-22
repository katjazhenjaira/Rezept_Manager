# Recipe Manager — Status

## Активная фаза

Все 3 бага из `ROADMAP.md` → «Баги» закрыты (несброс `formData`, `generateImage()` без try/catch, импорт по ссылке — оказался невалидным `GEMINI_API_KEY`, не дефектом кода). Gemini API key перевыпущен под аккаунтом пользователя (Google AI Pro/Ultra) и обновлён и локально, и на проде. Phase 3 (миграция на Supabase) не начата — ничего не блокирует старт, кроме выбора пользователя, с чего продолжить.

## Следующий шаг

Не выбран явно — на выбор пользователя в следующей сессии:

- Начать **Phase 3** (миграция на Supabase) — детали в `ROADMAP.md`.
- Или **PERF-2** (`subscribeAll` без `limit()`, отложена — требует решения по пагинации UI) — см. `ROADMAP.md` → «Технический долг».
- Или **PERF-5 остаток** (`PlannerView.tsx` — нужен `PlannerEntryCard` перед `React.memo`) — см. `ROADMAP.md` → «Технический долг».
- Или новая находка: **прод-домен `rezept-manager.flowgence.de` не проходит TLS-handshake** (DNS указывает на HostEurope, не на Cloudflare) — см. `ROADMAP.md` → «Технический долг».

## Blocker

Нет для Phase 3/PERF-2/PERF-5. Для прод-домена — требуется разобраться с DNS/Cloudflare-прокси настройками (см. ниже).

## Обновлено

2026-07-22

---

## Итоги последней сессии

- Закрыт баг: `generateImage()` в `handleAddManual` (`AddRecipeModals.tsx`) вызывался вне `try/catch` и молча обрывал сохранение рецепта при сетевой ошибке — обёрнут в свой try/catch с fallback (сохранение без фото). Регрессионный тест добавлен (commit `74415f2`).
- Закрыт баг: форма ручного добавления/редактирования рецепта не сбрасывала `formData` при закрытии (фон/крестик/«Отмена») — единая функция `closeManualModal()` сбрасывает `isAddingManual`/`editingId`/`formData` во всех трёх путях. Регрессионный тест добавлен (commit `ba688c8`).
- Продиагностирован и закрыт баг «Импорт рецепта по ссылке не работает»: не дефект кода — невалидный `GEMINI_API_KEY` (создан партнёром, доступ под вопросом). Подтверждено воспроизведением идентичной ошибки на несвязанном AI-роуте (`calculate-kbzhu`).
- Пользователь перевыпустил Gemini API key в Google AI Studio под своим аккаунтом (подписка Google AI Pro/Ultra) — обновлён локально (`worker/.dev.vars`) и на проде (через Cloudflare Dashboard, аккаунт `rezept-manager@flowgence.de`), подтверждено `wrangler deployments list`.
- При сквозной проверке через публичный URL обнаружена отдельная, не связанная с ключом проблема: прод-домен `rezept-manager.flowgence.de` не проходит TLS-handshake (DNS резолвится в IP HostEurope, не Cloudflare) — отложена пользователем как отдельная задача.
- Попутная уборка: убран неиспользуемый `GEMINI_API_KEY` из корневого `.env`, поправлена инструкция в `README.md` (устаревший `.env.local` → `worker/.dev.vars`).

## Ключевые решения, влияющие на следующий шаг

- Все 3 пункта из «Баги» в `ROADMAP.md` закрыты — раздел можно считать пустым до появления новых находок.
- Gemini API key теперь полностью под контролем пользователя (не партнёра) — см. memory `project_gemini_key_migration.md`.
- Новый открытый TODO с более высоким практическим приоритетом, чем Phase 3/PERF: прод-домен может быть недоступен для реальных пользователей из-за DNS/Cloudflare-прокси проблемы — стоит разобраться раньше, чем начинать Phase 3, если планируется реальный запуск.

---

## Где искать контекст

- `ROADMAP.md` — активные + будущие фазы (Phase 3, 4, 5), технический долг (PERF-2, PERF-5 остаток, прод-домен TLS/DNS)
- `docs/audits/2026-07-19-project-audit-report.md` — отчёт аудита, закрыт полностью (60/60)
- `docs/audits/conv-1-decomposition-plan.md` — план декомпозиции RecipesView.tsx (CONV-1), все шаги [x]
- `Application_description.md` — бизнес-логика (6 вкладок, AI-правила, UX)
- `Technical_Project_Documentation.md` — архитектура, стек, файловая структура, env vars
- `docs/roadmap-archive/` — завершённые фазы (0a, 0b, 1, 2) + журнал решений
- `docs/superpowers/specs/` — спеки фаз
