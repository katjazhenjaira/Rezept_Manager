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

| Вопрос | Выбор | Почему |
|--------|-------|--------|
| Supabase vs Firebase long-term | **Supabase** (Phase 3) | Postgres + RLS подходит для multi-tenant; биллинг за чтения дешевле на масштабе |
| Хостинг | **Cloudflare остаётся** | Free tier щедрее Vercel (unlimited bandwidth, 100k Worker req/day) |
| Next.js | **Отложен** | App-like приложение, SSR не работает с real-time; вернёмся только при SEO-потребности |
| Auth timing | **До миграции Supabase** (Phase 2, Firebase Auth) | Избегаем периода «открытая БД без Auth» |
| Phase 1 extras | **Vitest + i18n сразу** | Тесты страхуют рефакторинг; i18n дешевле ввести при разбиении |

---

## Технический долг

- [ ] Проработать отчёт аудита кода `docs/audits/2026-07-19-project-audit-report.md` (60 находок: 8 критических — дублирование allergy/КБЖУ-логики, base64-картинки в Firestore, открытый CORS и SSRF в Worker, отсутствие серверной валидации fillRemaining; плюс 15 расхождений с документацией и находки по остальным категориям)

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
