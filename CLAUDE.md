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

6. **Запушь все локальные коммиты** (`git push`) в `origin` — не только коммит документации из шага 5, но и все накопленные за сессию коммиты. Делай это всегда при прощании, без отдельного запроса пользователя, если он явно не запретил пуш в этой сессии.

7. **Кратко сообщи пользователю**, что было сохранено и запушено (1-2 предложения, по списку изменённых файлов и итогу пуша), и только после этого прощайся.

Если пользователь явно сказал «не сохраняй» или «не обновляй документы» — пропусти шаги 1-5, но шаг 6 (пуш) всё равно выполни, если он не запрещал именно пуш; шаг 7 замени на «документы не обновлял по твоей просьбе» (с уточнением, был ли пуш).

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
- **Worker: любой server-side `fetch()` на URL, заданный клиентом, — потенциальный SSRF.** Решено (2026-07-19, CRIT-5): использовать `validateExternalUrl()`/`safeFetch()` из `worker/src/helpers/validateExternalUrl.ts` — блокирует не-http(s) протоколы, literal loopback/private/link-local хосты (включая IPv4-mapped IPv6) и ревалидирует каждый редирект-хоп (`fetch` с `redirect: "manual"`, не автоследование). Новый код в `worker/src/routes/`, добавляющий `fetch()` на клиентский URL (og:image, webhook, произвольная ссылка и т.п.), обязан идти через эти хелперы, а не голый `fetch()`.
- **Worker: не возвращать `err.message` клиенту.** Решено (2026-07-19, CRIT-8): полная ошибка — только в `console.error` на сервере, клиенту — фиксированное generic-сообщение (см. `app.onError` в `worker/src/index.ts` и catch-блоки в `worker/src/routes/*.ts`). Раскрытие SDK/парсинг-деталей клиенту — информационная утечка.
- **Worker: rate limit на KV — мягкий, не строгий.** Осознанно (2026-07-19, LOGIC-7): `worker/src/middleware/rateLimit.ts` использует Cloudflare KV (`RATE_LIMIT_KV`), которая eventually consistent и не даёт compare-and-swap — последовательность `get`→`put` не атомарна, при параллельных запросах с одного IP лимит (10/мин) может быть превышен на несколько запросов в пределах минуты. Осознанный выбор: KV защищает от злоупотребления Gemini API, а не служит строгим биллинг-гейтом, точная атомарность не требуется. Строгую атомарность даёт только Durable Objects — если появится реальная потребность в жёстком лимите, миграцию делать через новый DO-класс + binding в `worker/wrangler.toml`, а не патчить KV.
- **Проверка аллергенов (safety-critical constraint №1) — только в UI-слое, не в репозиториях.** Осознанно (2026-07-19, LOGIC-9): `recipeAllergens()`/`recipeHasAllergens()` (`src/shared/domain/allergies.ts`) вызываются в UI непосредственно перед записью — например, `confirm()`-гейт в `PlannerView.handleAddToPlanner()` перед вызовом `plannerRepo.add()`. Репозитории (`PlannerRepository`, `FirestoreRecipesRepository` и т.д.) остаются чистым CRUD-слоем без знания об аллергиях — осознанно, чтобы не дублировать доменную логику в слое, который готовится к замене Firebase → Supabase (Phase 3). Любой новый путь добавления рецепта в Planner/Tracker/AI-suggestions обязан сам вызвать проверку аллергенов в UI/hook-слое перед записью — на уровне репозитория её никто не перехватит.
- **Worker: любой upstream-вызов (`ai.models.generateContent()`, `fetch()` на клиентский URL) обязан иметь timeout.** Решено (2026-07-21, PERF-7): `helpers/timeout.ts` — `UPSTREAM_TIMEOUT_MS` (25с) + `isTimeoutError()`. `generateContent()` получает `config.abortSignal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)`; `safeFetch()` (см. constraint выше) применяет свежий таймаут на каждый redirect-хоп. Catch-блоки различают таймаут через `isTimeoutError()` и возвращают чистый 504 (не 502) — не через `err.message` (см. constraint про `err.message` выше). Новый код с upstream-вызовом в `worker/src/routes/` обязан подключить `AbortSignal.timeout()`, иначе зависший запрос держит воркер без клиентского предела.
- **`render*View()`-функции внутри React-компонента, вызываемые условно (`plannerViewScale === 'week' && renderWeekView()`), не могут содержать хуки внутри себя.** Выявлено (2026-07-21, PERF-4/PERF-5): в `PlannerView.tsx` такие функции — не отдельные компоненты и не кастомные хуки, а обычные замыкания в теле компонента; `useMemo`/`useCallback`/`React.memo` внутри них нарушает rules-of-hooks при переключении между режимами (day/week/month/list рендерят разный набор функций). Мемоизация должна подниматься на уровень самого компонента (пример: `entriesByDate` в `PlannerView.tsx` — `Map` по дате, вычисляется один раз через `useMemo` в теле `PlannerView`, а `render*View()`-функции просто читают из неё). Аналогично `React.memo` не на чем закрепить для inline-JSX внутри `.map()` без отдельного вынесенного компонента (в отличие от `RecipesView.tsx`, где `RecipeCard.tsx` уже отдельный файл) — сначала нужно выделить компонент-границу, потом навешивать `memo`.
- **`react-hooks/set-state-in-effect` (ESLint): не рефакторить эффект вслепую ради тишины линтера.** Решено (2026-07-21, разбор DOC-14/eslint TODO): если эффект — намеренная синхронизация с внешней системой (URL query params при deep-link, сброс/загрузка формы при открытии/закрытии модалки), а не что-то, что можно вычислить через lazy `useState(() => ...)` initializer, правильный фикс — `// eslint-disable-next-line react-hooks/set-state-in-effect` с комментарием-обоснованием прямо над вызовом `setState`, а не насильный рефакторинг логики. Примеры: `App.tsx` (deep-link редирект на `recipeId`), `SettingsModal.tsx`/`ProgramSelectionModal.tsx` (sync/reset формы по `isOpen`). Когда же эффект реально не нужен (инициализация из `localStorage` один раз на mount) — переносить в lazy `useState`-initializer, а не глушить линтер (пример: `availableCategories` в `App.tsx`).

## Development conventions

- TypeScript **strict mode**; Prettier (format on save); ESLint
- Имена: `PascalCase` для компонентов, `camelCase` для функций/переменных, `UPPER_SNAKE_CASE` для констант
- Один компонент на файл; co-locate styles, types, tests с компонентом
- **Никаких прямых `fetch` в компонентах** — через сервисный слой (начиная с Phase 1)
- Commits: conventional (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- Ветки: `feature/`, `fix:`, `chore/`
- Комментарии в коде — только если объясняют неочевидное _почему_, а не _что_

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
