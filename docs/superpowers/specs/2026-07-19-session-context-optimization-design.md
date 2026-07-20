# Session Context Optimization — Design Spec

**Дата:** 2026-07-19  
**Статус:** approved  
**Scope:** оптимизация токен-стоимости старта сессии + техническая документация проекта

---

## Проблема

`ROADMAP.md` достиг ~304 строк (~4500 токенов). При каждом старте сессии Claude читает его целиком, хотя для ориентации нужно < 300 токенов. Это замедляет старт и расходует контекст без пользы.

---

## Решение — три части

### Часть 1: STATUS.md — «дашборд» сессии

Новый файл в корне проекта. Читается при каждом старте вместо ROADMAP.md. Размер: ~25-30 строк, ~250-300 токенов.

**Формат:**

```markdown
# Recipe Manager — Status

## Активная фаза

<название и статус>

## Следующий шаг

<конкретное действие>

## Blocker

<описание или «нет»>

## Обновлено

<YYYY-MM-DD>

---

## Итоги последней сессии

- <3-5 пунктов: что сделано>

## Ключевые решения, влияющие на следующий шаг

- <решения из последней сессии, важные для следующей>

---

## Где искать контекст

- `ROADMAP.md` — активные + будущие фазы (Phase 3, 4, 5)
- `Application_description.md` — бизнес-логика (6 вкладок, AI-правила, UX)
- `Technical_Project_Documentation.md` — архитектура, стек, файловая структура
- `docs/roadmap-archive/` — завершённые фазы, журнал решений
- `docs/superpowers/specs/` — спеки фаз
```

### Часть 2: Реструктуризация ROADMAP.md + архив

**ROADMAP.md** сокращается до ~80-100 строк. Содержит только:

- Финальная цель проекта
- Стратегические решения (таблица)
- Активная и будущие фазы (Phase 3, 4, 5) с чеклистами и DoD
- Протокол работы над роадмапом

Завершённые фазы и журнал решений уходят в архив.

**Структура архива:**

```
docs/roadmap-archive/
├── decisions-log.md       ← весь журнал решений из ROADMAP.md
├── phase-0a.md            ← security hygiene
├── phase-0b.md            ← Gemini proxy
├── phase-1.md             ← разбор монолита
└── phase-2.md             ← Firebase Auth + Security Rules
```

Каждый архивный файл содержит:

- Статус и дату завершения
- Полный чеклист с [x]
- Критерий готовности (DoD)
- Ключевые решения, принятые в рамках фазы

`decisions-log.md` содержит все записи из раздела «Журнал решений» без изменений.

**Правило автоархивации:** при завершении фазы в session end protocol Claude:

1. Создаёт `docs/roadmap-archive/phase-N.md` с полным содержимым фазы
2. Убирает фазу из ROADMAP.md
3. Переносит новые решения в `decisions-log.md`

### Часть 3: Technical_Project_Documentation.md

Новый файл в корне проекта. Читается только при необходимости (новый контекст, новый член команды, ad-hoc задача вне знакомой области).

**Разделы:**

1. **Обзор проекта** — что за приложение, аудитория, масштаб, текущий статус
2. **Технический стек** — все технологии с версиями и ролями (frontend, backend, AI, hosting, testing)
3. **Архитектура** — слои приложения:
   - `shared/domain/` — типы, бизнес-логика (macros, allergies)
   - `infrastructure/` — Firestore реализации, converters, auth
   - `features/` — 6 feature-модулей (recipes, planner, tracker, cart, programs, auth)
   - `app/` — providers, layout, Shell, TabBar
   - `worker/` — Cloudflare Worker (Gemini proxy, rate limiting)
   - Схема: как провайдеры оборачивают друг друга (AuthProvider → RepositoryProvider → DataProvider → App)
   - Repository pattern: интерфейс в `src/services/`, реализация в `src/infrastructure/`
4. **Структура файлов** — модульный уровень, 3-5 ключевых файлов в каждом блоке с ролью
5. **Внешние сервисы** — для каждого: назначение, аккаунт, проект/app ID, dashboard URL, что хранится:
   - Firebase (`rezept-manager-62bd0`) — Firestore (данные), Auth (пользователи), Security Rules
   - Cloudflare — Pages (фронтенд, домен `rezept-manager.flowgence.de`), Worker (Gemini proxy), KV (rate limiting)
   - Google Gemini — модели (`gemini-2.5-flash`, `gemini-2.5-flash-image`), 6 маршрутов
6. **Переменные окружения** — таблица:

   | Переменная           | Описание              | Где задана        | Кто использует |
   | -------------------- | --------------------- | ----------------- | -------------- |
   | `VITE_FIREBASE_*`    | Firebase config       | `.env`            | фронтенд       |
   | `VITE_AI_WORKER_URL` | URL Cloudflare Worker | `.env` (prod)     | `aiClient.ts`  |
   | `GEMINI_API_KEY`     | Gemini API ключ       | Cloudflare secret | Worker         |
   | ...                  | ...                   | ...               | ...            |

7. **Data flow** — сценарии (~3-4 строки каждый):
   - «Пользователь добавляет рецепт вручную»
   - «Импорт рецепта из PDF»
   - «AI fill remaining KBZHU»
   - «Авторизация пользователя»
8. **Локальная разработка** — шаги: `npm install`, `.env` из `.env.example`, `wrangler dev` + `npm run dev`, что проверить
9. **Деплой** — Pages: автоматически через `git push main`; Worker: `wrangler deploy` из `worker/`; переменные в Cloudflare dashboard
10. **Тестирование** — `npm test` / `npm run coverage`; что покрыто (shared/domain 100%, repos, providers, auth); что не покрыто (Worker, e2e)
11. **Технические ограничения** — Canvas API недоступен в Worker (PDF-операции на клиенте), Firestore лимит 1MB (base64 изображения не хранить), Gemini rate limits

---

## Изменения в CLAUDE.md

### Session start protocol (замена текущего)

```
1. Прочитай `STATUS.md` → раздел «Активная фаза» и «Следующий шаг».
2. Одним предложением сообщи пользователю: активная фаза, следующий шаг, дата.
3. Дождись подтверждения.
   - Если работаем по плану → читай ROADMAP.md для деталей текущей фазы.
   - Если ad-hoc задача → читай нужный контекст по ситуации.
```

### Session end protocol (добавляется шаг)

После существующих шагов 1-4, добавить новый шаг **1a**:

```
1. Обновить `STATUS.md`:
   - Активная фаза, следующий шаг, blocker, дата
   - Итоги сессии (3-5 пунктов)
   - Ключевые решения для следующего шага

1a. Если в сессии фаза отмечена завершённой ([x] все подзадачи):
   - Создать `docs/roadmap-archive/phase-N.md` с полным содержимым фазы
   - Убрать фазу из ROADMAP.md
   - Добавить решения сессии в `docs/roadmap-archive/decisions-log.md`

2. Обновить `ROADMAP.md` → отметить [x] подзадачи текущей фазы.
```

### При создании новых файлов

```
При добавлении нового файла или модуля → обновить раздел «Структура файлов»
в Technical_Project_Documentation.md.
При изменении env-переменных, деплоя, внешних сервисов → обновить
соответствующий раздел.
```

---

## Миграция (что делаем с текущим ROADMAP.md)

1. Создать `docs/roadmap-archive/decisions-log.md` — перенести раздел «Журнал решений»
2. Создать `docs/roadmap-archive/phase-0a.md`, `phase-0b.md`, `phase-1.md`, `phase-2.md` — перенести завершённые фазы
3. Удалить из ROADMAP.md: завершённые фазы (0a, 0b, 1, 2) + журнал решений
4. Создать `STATUS.md` с текущим состоянием (Phase 3, следующий шаг, итоги Phase 2)
5. Создать `Technical_Project_Documentation.md` (наполнить на основе кодовой базы)
6. Обновить `CLAUDE.md` — новые протоколы start/end + правило обновления TechDoc
7. Один коммит: `docs: restructure ROADMAP — STATUS.md, archive, TechDoc`

---

## Критерий готовности

- `STATUS.md` читается за одно чтение, содержит всё для старта сессии
- `ROADMAP.md` < 100 строк (только Phase 3+)
- `docs/roadmap-archive/` содержит все 4 завершённые фазы + decisions-log
- `Technical_Project_Documentation.md` существует и покрывает все 11 разделов
- `CLAUDE.md` обновлён: session start читает STATUS.md, session end обновляет STATUS.md + архивирует фазы
- Токен-стоимость старта сессии: ~300 токенов (было ~4500)
