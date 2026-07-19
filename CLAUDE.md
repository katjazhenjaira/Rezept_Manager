# Recipe Manager — Project Instructions for Claude Code

## Что это

Мобильное/веб-приложение для интеллектуального управления питанием: умная кулинарная книга + планер + AI-диетолог. Пользователи — нутрициологи, диетологи, тренеры, meal-prep специалисты, health-conscious люди. Целевой масштаб — десятки тысяч конечных пользователей и тысячи консультантов.

## Где лежат детали

- **Статус текущей сессии** — `STATUS.md` в корне. Читай в начале каждой сессии (~300 токенов).
- **Бизнес-логика и продуктовые фичи** — `Application_description.md` в корне (authoritative source по поведению 6 вкладок, правилам AI, UX-логике). Читай когда задача касается продуктового поведения.
- **Активные и будущие фазы** — `ROADMAP.md` в корне. Читай при работе над плановой фазой.
- **Техническая документация** — `Technical_Project_Documentation.md` в корне. Читай при необходимости глубокого технического контекста (архитектура, env vars, деплой, ограничения).
- **Завершённые фазы и решения** — `docs/roadmap-archive/` (phase-0a.md, phase-0b.md, phase-1.md, phase-2.md, decisions-log.md).

## Session start protocol

1. Прочитай `STATUS.md` — активная фаза, следующий шаг, дата.
2. Одним предложением сообщи пользователю: активная фаза, следующий шаг, дата обновления.
3. Дождись подтверждения.
   - Если работаем по плану → прочитай `ROADMAP.md` для деталей текущей фазы.
   - Если ad-hoc задача → читай нужный контекст по ситуации (TechDoc, Application_description.md и т.д.).

## Session end protocol

**Триггер:** пользователь прощается или сигнализирует об окончании работы. Типичные паттерны:
- Русский: «пока», «до завтра», «на сегодня всё», «до встречи», «заканчиваем», «до следующего раза», «спокойной ночи», «хорошего вечера»
- Английский: «bye», «goodbye», «see you», «end session», «that's all for today»

**При триггере, до прощания, выполни:**

1. **Обнови `STATUS.md`:**
   - Активная фаза, следующий шаг, blocker, дата «Обновлено».
   - Раздел «Итоги последней сессии» (3-5 пунктов: что сделано в этой сессии).
   - Раздел «Ключевые решения, влияющие на следующий шаг».

1a. **Если в сессии фаза завершена** (все подзадачи [x]):
   - Создай `docs/roadmap-archive/phase-N.md` с полным содержимым фазы (чеклист, DoD, ключевые решения).
   - Убери завершённую фазу из `ROADMAP.md`.
   - Добавь решения сессии в `docs/roadmap-archive/decisions-log.md`.

2. **Обнови `ROADMAP.md`** — отметь `[x]` подзадачи текущей фазы, завершённые в этой сессии.

3. **Обнови `Application_description.md`** — если в ходе сессии менялась продуктовая/бизнес-логика. Если нет — пропусти.

4. **Добавь запись в `docs/roadmap-archive/decisions-log.md`** — если было значимое архитектурное решение (выбор библиотеки, смена подхода, обнаружение блокера).

3a. **Сохрани нефиксированные замечания из code review субагентов** по правилу:
   - Actionable TODO (нужно сделать X) → добавь пункт `[ ] TODO (code review): ...` в чеклист текущей фазы `ROADMAP.md`
   - Ограничение/антипаттерн для этого проекта → добавь в раздел «Known constraints» `CLAUDE.md`
   - Паттерн/подход который здесь работает → сохрани в memory-файл

5. **Закоммить изменения документации** одним коммитом с сообщением `docs: update roadmap and business logic — session YYYY-MM-DD`, только если пользователь этого не запретил ранее в сессии.

6. **Кратко сообщи пользователю**, что было сохранено (1-2 предложения, по списку изменённых файлов), и только после этого прощайся.

Если пользователь явно сказал «не сохраняй» или «не обновляй документы» — пропусти шаги 1-5, но шаг 6 замени на «документы не обновлял по твоей просьбе».

## Tech Stack

- **Frontend:** React 19 + TypeScript 5.8 strict + Vite 6 + Tailwind CSS v4
- **State management:** сейчас — `useState` в монолитном `App.tsx`; Phase 1 переводит на Context + Repository pattern + custom hooks
- **Backend / DB:** Firebase 12 (Firestore) → мигрируем на Supabase в Phase 3
- **AI:** Google Gemini (`@google/genai`); Phase 0b выносит на Cloudflare Worker (серверный прокси)
- **UI libs:** `lucide-react`, `motion`, `clsx`+`tailwind-merge`, `react-markdown`, `date-fns`, `pdfjs-dist` (клиентский парсинг PDF)
- **Hosting:** Cloudflare Pages + Workers (решено в пользу Cloudflare vs Vercel — лучший free tier)

## Safety-critical constraints — не нарушать никогда

1. **Allergy check** обязателен перед добавлением рецепта в Planner / Tracker / AI-suggestions. Это safety-critical, обхода нет.
2. **KBZHU consistency** — суммы калорий и макросов в Planner, Tracker и Programs должны оставаться синхронными.
3. **Active program overrides profile goals** в Tracker, когда программа или подпапка активна; без активной программы действуют цели из профиля.
4. **Firebase / Supabase — единственный источник истины.** `localStorage` допустим только как optimistic cache для мгновенного UI.
5. **"Fill remaining KBZHU"** AI-запрос всегда включает: remaining macros, user allergies, active program rules (allowedProducts / forbiddenProducts), user recipe library. Ответ — ровно 3 варианта с порцией и обоснованием.

## Known constraints

Ограничения, выявленные в ходе разработки — учитывать автоматически:

- **Firestore: не хранить base64-картинки.** Лимит документа — ~1 МБ. Решено (2026-07-19, CRIT-1): `FirestoreRecipesRepository`/`FirestoreProgramsRepository` прогоняют `image`-поля через `resolveImageField()` (`src/infrastructure/firebaseStorage.ts`) — `data:` URI автоматически грузится в Firebase Storage, в Firestore пишется только URL. Новый код, пишущий `image`/`dishImage` напрямую в Firestore в обход этих репозиториев, нарушит constraint. `storage.rules` деплоится вручную через Firebase Console (CLI не настроен, как и для `firestore.rules`).
- **Не хранить `GEMINI_API_KEY` на клиенте.** Все Gemini-вызовы идут через Cloudflare Worker (`/api/ai/*`). Прямой `new GoogleGenAI(process.env.GEMINI_API_KEY)` в коде фронтенда — ошибка.
- **Cloudflare Worker: Canvas API недоступен.** Операции с PDF-изображениями (`extractImageFromPDF`) должны выполняться на клиенте через `pdfjs-dist`.

## Development conventions

- TypeScript **strict mode**; Prettier (format on save); ESLint
- Имена: `PascalCase` для компонентов, `camelCase` для функций/переменных, `UPPER_SNAKE_CASE` для констант
- Один компонент на файл; co-locate styles, types, tests с компонентом
- **Никаких прямых `fetch` в компонентах** — через сервисный слой (начиная с Phase 1)
- Commits: conventional (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- Ветки: `feature/`, `fix:`, `chore/`
- Комментарии в коде — только если объясняют неочевидное *почему*, а не *что*

## Technical documentation update rule

При добавлении нового файла или модуля → обновить раздел «Структура файлов» в `Technical_Project_Documentation.md`.

При изменении env-переменных, деплоя или внешних сервисов → обновить соответствующий раздел в `Technical_Project_Documentation.md`.

## Audit scope

Конфигурация для скилла `project-audit`. Читается автоматически при аудите кода.

**Исходный код:**
- `src/` — React-фронтенд (features, infrastructure, services, shared)
- `worker/src/` — Cloudflare Worker (AI-маршруты, middleware)
- `scripts/` — утилитные скрипты

**Конфигурационные файлы для проверки:**
- `firestore.rules` — правила безопасности Firestore
- `wrangler.toml` — конфигурация Cloudflare Worker
- `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`

**Документация для проверки на противоречия:**
- `Application_description.md` — продуктовое поведение (авторитетный источник)
- `Technical_Project_Documentation.md` — архитектура и структура файлов

## Проработка отчётов аудита (`docs/audits/*.md`)

Когда пользователь просит проработать отчёт аудита кода (или пункт из раздела «Технический долг» в `ROADMAP.md`, ссылающийся на такой отчёт):

1. **Обрабатывать находки по одной**, не пачками — даже если пользователь согласился исправить сразу несколько или «всё». Один цикл: выбрать находку → исправить → проверить (тесты/typecheck) → закоммитить → отметить в отчёте → перейти к следующей.
2. **Коммит после каждой проработанной находки** — отдельным коммитом, с сообщением, ссылающимся на её ID из отчёта (например `fix: устранить дублирование allergy-проверки (CRIT-2)`). Не объединять несколько находок в один коммит.
3. **Отмечать выполненные пункты прямо в файле отчёта** (`docs/audits/YYYY-MM-DD-project-audit-report.md`) сразу после коммита — например, дописывать в конец находки `✅ Исправлено (commit <hash>)` или менять её статус. Отчёт должен всегда отражать актуальное состояние проработки.
4. **Не убирать пункт из `ROADMAP.md`**, пока не проработаны (или осознанно не отклонены с пометкой) все находки отчёта — даже если сессия прерывается на середине. Пункт в roadmap остаётся до полного закрытия отчёта.
