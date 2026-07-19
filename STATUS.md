# Recipe Manager — Status

## Активная фаза
Phase 3 — миграция на Supabase (не начата)

## Следующий шаг
Создать Supabase-проект, настроить Auth (email + Google OAuth)

## Blocker
нет

## Обновлено
2026-07-19

---

## Итоги последней сессии
- Phase 2 завершена: Auth email/password + Firestore Security Rules задеплоены, security-review пройден
- Исправлена HIGH-уязвимость: userId-overwrite в firestore.rules (userId immutable при update, commit aecde4a)
- Firebase-проект мигрирован с партнёрского аккаунта на личный (rezept-manager-62bd0, videnejev@gmail.com)
- Phase 1 DoD закрыт: прямые firebase/firestore импорты удалены из всех feature-файлов → useRepositories()
- Реструктурирована документация: STATUS.md, docs/roadmap-archive/, Technical_Project_Documentation.md

## Ключевые решения, влияющие на следующий шаг
- Repository pattern уже реализован — для Supabase нужны только новые реализации интерфейсов из `src/services/`
- Feature flag `VITE_BACKEND=firebase|supabase` переключает бэкенд в `src/infrastructure/createRepositories.ts`
- Миграция данных: dry-run на staging → валидация → prod (порядок: users → profiles → recipes → programs → entries → cart)
- Auth migration: экспорт scrypt-хешей из Firebase, импорт в Supabase

---

## Где искать контекст
- `ROADMAP.md` — активные + будущие фазы (Phase 3, 4, 5)
- `Application_description.md` — бизнес-логика (6 вкладок, AI-правила, UX)
- `Technical_Project_Documentation.md` — архитектура, стек, файловая структура, env vars
- `docs/roadmap-archive/` — завершённые фазы (0a, 0b, 1, 2) + журнал решений
- `docs/superpowers/specs/` — спеки фаз
