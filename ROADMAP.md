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

## Технический долг

- [ ] Проработать отчёт аудита кода `docs/audits/2026-07-22-project-audit-report.md` (39 находок: 2 критических, 6 противоречий с документацией, 3 недокументированных, 10 логических, 6 dead code, 4 TypeScript, 2 конвенции, 1 perf, 5 по тестовому покрытию). Разбито на 13 групп по файловой локальности — план и порядок в `docs/plans/2026-07-22-audit-followup-groups.md`, текущий статус — таблица «Прогресс проработки» в начале самого отчёта. **Состояние на 2026-07-23: закрыто 36 из 39** — группы 1-11b `✅` (обе safety-critical находки устранены, фронтенд-тесты 177 → 283). Осталась группа 12: LOG-4 (персистентность `mealTypes`), DEAD-4 (поведение при удалении категории), DOC-5 (шеринг программ между пользователями) — все три требуют продуктового решения, вопросы сформулированы в `STATUS.md`
- [ ] TODO (обнаружено при проработке LOG-5, 2026-07-22): мёртвая ветка `activeResourceForm` в `src/features/programs/ProgramDetailModal.tsx` (~214-234) и связанная модалка «Добавить документ/ссылку» (~1481-1600) недостижимы — `setActiveResourceForm` нигде не вызывается с непустым значением, состояние всегда `null`. Из-за этого ветка не покрывается тестом (записано в «Нетестируемые сценарии» TechDoc §9). Решение продуктовое: либо подключить кнопку открытия формы, либо удалить ветку вместе с модалкой
- [x] Проработать отчёт аудита кода `docs/audits/2026-07-19-project-audit-report.md` — все 60 находок проработаны (58 исправлено; PERF-2 осознанно отложена; PERF-5 закрыта частично) — см. пункты ниже по PERF-2/PERF-5 остатку, которые остаются открытыми отдельно от самого отчёта
- [x] Разобрать находки `eslint src` (см. DOC-14) — закрыто 2026-07-21: 28 находок (27 errors/1 warning на момент разбора — часть из исходных 35/2 уже устранилась в ходе CONV-1/PERF-рефакторингов), 9 коммитов по файлам (`App.tsx`, `I18nProvider.tsx`+`i18nConfig.ts`, `PlannerView.tsx`+тест, `ProgramDetailModal.tsx`, `SettingsModal.tsx`, `ProgramSelectionModal.tsx`, `TrackerView.test.tsx`, `main.tsx`+`AuthenticatedApp.tsx`). `eslint src` чист. Намеренные `setState`-в-эффекте (deep-link редирект, sync формы с контекстом при открытии, сброс формы при закрытии) помечены `eslint-disable` с обоснованием, а не рефакторены — см. `CLAUDE.md` → Known constraints.
- [ ] TODO (code review, PERF-2): `subscribeAll`-запросы (Cart/Planner/Programs/Recipes) без `limit()`/ограничения по дате — каждый listener ресинкает всю коллекцию пользователя на каждое изменение. Не критично сейчас, но CLAUDE.md целится в «десятки тысяч» пользователей с годами истории планера. Решение отложено (2026-07-21): `Planner` — единственная коллекция, где лимит по дате естественен без пагинации в UI (план питания и так временно ограничен); `Cart`/`Recipes`/`Programs` не date-bound, и вся текущая UI-логика (поиск/фильтрация в `RecipesView` и т.д.) ожидает весь набор данных пользователя на клиенте — добавить `limit()` туда без пагинации в UI означало бы молча обрезать библиотеку рецептов/программ, что требует отдельного продуктового решения по пагинации, а не точечного фикса.
- [ ] TODO (code review, PERF-5 остаток): `PlannerView.tsx` — записи плана рендерятся как inline JSX внутри `.map()` в 4 render-функциях (Day/Week/Month/List), а не отдельным компонентом. `React.memo` тут не на чем закрепить без предварительного выделения `PlannerEntryCard`-компонента — по объёму это мини-декомпозиция (похожая на CONV-1, но для `PlannerView.tsx`), а не точечный perf-фикс. Отложено по решению пользователя (2026-07-21) в рамках обработки PERF-5.
- [x] Обновить прод-секрет `GEMINI_API_KEY` на задеплоенном Worker — закрыто (2026-07-22): пользователь обновил ключ через Cloudflare Dashboard (Workers & Pages → `rezept-manager-worker` → Settings → Variables and Secrets), подтверждено через `wrangler deployments list` (`Updated secret: GEMINI_API_KEY`, deployment создан). Аккаунт `rezept-manager@flowgence.de` (не личный аккаунт партнёра — см. уточнение ниже).
- [ ] TODO: прод-домен `rezept-manager.flowgence.de` не проходит TLS-handshake (`tlsv1 alert internal error`, подтверждено двумя независимыми TLS-стеками — macOS SecureTransport и Node/OpenSSL) — DNS резолвится в IP HostEurope (`217.160.0.71` / `2001:8d8:100f:f000::200`), не в Cloudflare anycast-диапазон, то есть трафик, похоже, не проходит через Cloudflare-прокси вообще. Для сравнения `rezept-manager-test.flowgence.de` резолвится в Cloudflare IP и TLS работает, но Worker-роут `/api/*` к нему не привязан (запрос падает в SPA-фолбэк `index.html`). Из-за этого не удалось сквозняком через публичный URL подтвердить работу обновлённого `GEMINI_API_KEY` на проде (подтверждено только косвенно — через `wrangler deployments list` и локальный `wrangler dev`). Обнаружено 2026-07-22 при верификации переноса Gemini-ключа, отложено пользователем как отдельная задача — требует проверки DNS/Cloudflare-прокси настроек для основного домена и/или привязки Worker route к нему.

## Баги

- [x] Импорт рецепта по ссылке не работает (вкладка «Рецепты» → «Импорт по ссылке»). **Диагностировано и исправлено (2026-07-22):** это не был дефект кода — цепочка `AddRecipeModals.handleLinkSubmit` → `aiClient.importFromUrl()` → Worker `/api/ai/import-from-url` → Gemini работала корректно. Причина — невалидный/отозванный `GEMINI_API_KEY` (создан партнёром пользователя, доступ к аккаунту создателя под вопросом). Подтверждено воспроизведением идентичной ошибки `API_KEY_INVALID` на несвязанном AI-роуте (`/api/ai/calculate-kbzhu`) с тем же ключом — значит, проблема не специфична для `importFromUrl`. Ключ перевыпущен пользователем в Google AI Studio под своим аккаунтом (подписка Google AI Pro/Ultra), обновлён в `worker/.dev.vars`. Локально проверено: оба роута возвращают `200 OK`. Прод-секрет тоже обновлён пользователем через Cloudflare Dashboard (см. «Технический долг» — при верификации обнаружена отдельная, не связанная с ключом проблема с TLS/DNS основного прод-домена, вынесена туда же отдельным TODO).
- [x] Форма добавления/редактирования рецепта (`AddRecipeModals.tsx`) не сбрасывала `formData` при закрытии («Отмена» / крестик / клик по фону) — сбрасывались только `editingId`/`isAddingManual` (клик по фону не сбрасывал даже `editingId`). Обнаружено при ручном смоук-тесте CONV-1 (2026-07-21): после отмены редактирования существующего рецепта и повторного открытия «Добавить вручную» форма показывала данные предыдущего (отредактированного) рецепта вместо пустой. Pre-existing баг, подтверждено — идентичная структура кода была уже в `RecipesView.tsx` до декомпозиции CONV-1, не регрессия рефакторинга. **Исправлено (2026-07-22, commit ba688c8):** единая функция `closeManualModal()` сбрасывает `isAddingManual`/`editingId`/`formData` во всех трёх путях закрытия; добавлен регрессионный тест на кнопку «Отмена».
- [x] `handleAddManual` (`AddRecipeModals.tsx`) — вызов `aiClient.generateImage()` для авто-генерации фото стоял вне `try/catch`. Если запрос падал (сеть, недоступен Cloudflare Worker, 500/timeout), вся функция обрывалась необработанным исключением до сохранения рецепта — рецепт не сохранялся, пользователь не получал никакой ошибки/уведомления. Воспроизведено при смоук-тесте CONV-1 (2026-07-21, `/api/ai/generate-image` вернул 500 — счётчик «Найдено» подтвердил, что рецепт не добавился). Pre-existing баг (идентичная структура была в `RecipesView.tsx` до декомпозиции). **Исправлено (2026-07-22, commit 74415f2):** вызов `generateImage()` обёрнут в свой `try/catch` — при ошибке генерации рецепт сохраняется без фото, аналогично другим AI-путям в этом же файле. Добавлен регрессионный тест `src/features/recipes/__tests__/AddRecipeModals.test.tsx`.

## Активные фазы

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

## Будущие фазы

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
