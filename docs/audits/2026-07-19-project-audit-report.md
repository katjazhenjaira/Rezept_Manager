# Аудит кода — отчёт

**Дата:** 2026-07-19
**Область:** `src/`, `worker/src/`, `scripts/`, конфиги (`firestore.rules`, `wrangler.toml`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`), документация (`Application_description.md`, `Technical_Project_Documentation.md`, `ROADMAP.md`, `STATUS.md`, `docs/roadmap-archive/`).

## Сводка

| Категория | Найдено |
|-----------|---------|
| 🔴 Критические нарушения | 8 |
| 🟠 Противоречия с документацией | 15 |
| 📋 Недокументированная логика | 1 |
| 🔵 Логические ошибки | 9 |
| 🟡 Мёртвый / избыточный код | 9 |
| ⚡ TypeScript strict | 7 |
| 🏛️ Соответствие соглашениям | 3 |
| 🔄 Импорты / зависимости | 0 |
| 🐢 Производительность | 8 |
| **Итого** | **60** |

---

## 🔴 Критические нарушения

**[CRIT-1]** `src/infrastructure/firestore/FirestoreRecipesRepository.ts:43-50`, `FirestoreProgramsRepository.ts:46-53`
> **Проблема:** Репозитории принимают поля `image`/`dishImage`/`pdfUrl` без каких-либо проверок содержимого. `RecipesView.tsx:420-424,509-513,1614-1618` и `ProgramsView.tsx:146-147` пишут туда `imageDataUri` из `aiClient.generateImage()` (base64, ~700KB+) напрямую перед вызовом `add()`/`update()`.
> **Почему важно:** Нарушение Known constraint «не хранить base64-картинки в Firestore» (лимит документа ~1MB). Репозиторий — последний рубеж перед записью, и он ничего не блокирует.
> **Исправление:** Добавить guard в репозитории (throw при `data:` URI выше безопасной длины) и завести загрузку через Firebase Storage/R2, храня в Firestore только URL.
> **✅ Исправлено:** Добавлен `src/infrastructure/firebaseStorage.ts` (`resolveImageField()` — загружает `data:` URI в Firebase Storage под `users/{uid}/{folder}/`, возвращает Storage URL; обычные значения и `undefined` проходят без изменений). Подключён в `FirestoreRecipesRepository.add/update` (поле `image`) и `FirestoreProgramsRepository.add/update` (поле `image` + `subfolders[].image`) — теперь это единая точка перехвата для всех текущих и будущих точек записи (ручное добавление, фото/PDF/ссылка-импорт, ручная загрузка обложки программы/подпапки), а не только для 2 мест, изначально указанных в находке. Убраны устаревшие guard'ы `.length <= 800_000 ? … : undefined` в `RecipesView.tsx`/`ProgramsView.tsx`, которые молча роняли крупные (но валидные) картинки вместо решения проблемы. Добавлен `storage.rules` (uid-scoped, лимит 5MB, только `image/*`) — требует ручного деплоя через Firebase Console (как и `firestore.rules`, CLI не настроен в проекте). Также попутно исправлено DOC-13 (названия Firestore-коллекций `planner`/`cart` вместо `planner_entries`/`cart_items`) в `Technical_Project_Documentation.md` — правилось той же строкой, что и Storage-документация.
> Тесты: `src/infrastructure/__tests__/firebaseStorage.test.ts` (9 новых), полный прогон 121/121 зелёный, `tsc --noEmit` и `vite build` чистые.
> **Ручная проверка (пользователь):** загрузка картинки в приложении протестирована вживую — файл успешно сохраняется в Firebase Storage. `storage.rules` задеплоены и работают корректно.

**[CRIT-2]** `src/features/planner/PlannerView.tsx:119-121`; `RecipesView.tsx:612-614,1193-1196,1218-1221,1274-1277,1313-1316`; `ProgramDetailModal.tsx:761-763,859-861`
> **Проблема:** Проверка аллергенов продублирована вручную (`allergies.filter(...ingredients.some(...includes...))`) в 7+ местах вместо вызова `recipeAllergens`/`recipeHasAllergens` из `src/shared/domain/allergies.ts`.
> **Почему важно:** Прямое нарушение принципа единого источника истины для safety-critical constraint №1. Любое будущее изменение логики сопоставления (нормализация, границы слов) придётся синхронно вносить в 7+ местах — иначе проверка на разных вкладках начнёт расходиться незаметно.
> **Исправление:** Заменить все инлайн-выражения на вызовы `recipeAllergens`/`recipeHasAllergens`.
> **✅ Исправлено:** Все 8 найденных мест (`PlannerView.tsx:119`, `RecipesView.tsx` ×5 — `handleAddToPlanner` + 3 инлайн-проверки на бейджи карточки рецепта + селект-режим, `ProgramDetailModal.tsx` ×2) заменены на вызовы `recipeAllergens`/`recipeHasAllergens` из `src/shared/domain/allergies.ts`. Импорты добавлены во все 3 файла. Тесты: полный прогон 121/121 зелёный, `tsc --noEmit` и `vite build` чистые.

**[CRIT-3]** `src/features/planner/PlannerView.tsx` (строки 150-169, 246-262, 447-463, 581-597); `src/features/tracker/TrackerView.tsx` (59-72, 74-80, 82-87)
> **Проблема:** Суммирование КБЖУ реализовано вручную 7 раз вместо `sumMacros`/`remainingMacros`/`resolveActiveTargets` из `src/shared/domain/macros.ts`. Ни один из файлов не импортирует `shared/domain/macros.ts` (проверено grep). `TrackerView.tsx` даже копирует строку `'По умолчанию (из настроек)'` из `resolveActiveTargets` — явный copy-paste.
> **Почему важно:** Прямое нарушение constraint №2 (KBZHU consistency между Planner/Tracker/Programs) — есть риск, что фикс в одном месте не долетит до остальных.
> **Исправление:** Заменить все дублирующиеся редьюсеры на вызовы shared-функций.
> **✅ Исправлено:** `PlannerView.tsx` — все 4 ad-hoc редьюсера (`getMacrosForDate`, `mealMacros`, `cellMacros`, `dayTotalMacros`) заменены на `sumMacros(entries, recipes)`. `TrackerView.tsx` — `actualMacros` → `sumMacros()`, `currentTargets` → `resolveActiveTargets(activeNutritionPlan, userProfile ?? DEFAULT_PROFILE)` (нулевой fallback заменён на `DEFAULT_PROFILE`, как в `App.tsx` — раньше при ещё не загруженном профиле цели показывались как 0/0/0/0, теперь корректные дефолты), `remainingMacros` (локальная переменная) → результат `remainingMacros()` из `shared/domain/macros.ts` (импортирован с алиасом `computeRemainingMacros` во избежание конфликта имён с локальной переменной). Тесты: полный прогон 121/121 зелёный, `tsc --noEmit` и `vite build` чистые.
> Не тронуто намеренно: `PlannerView.tsx` line ~583 (`totalCals` в месячном виде, LOGIC-4 — отдельная находка, undercounting для `type: 'product'`) и сравнение `isSelectedDateOverLimit` с `userProfile.target*` напрямую (не входит в CRIT-3 — Planner вообще не использует `activeNutritionPlan` для подсветки превышения лимита, это отдельный баг constraint №3, не описанный в исходном отчёте; стоит завести отдельной находкой).

**[CRIT-4]** `worker/src/index.ts:14`
> **Проблема:** `app.use("*", cors())` — Hono по умолчанию резолвит это в `origin: "*"` (подтверждено в `node_modules/hono/dist/middleware/cors/index.js`).
> **Почему важно:** Любой сторонний сайт может дёргать `/api/ai/*` из браузера пользователя — платный Gemini-прокси становится открытым для встраивания на чужих сайтах. Rate limit по IP не ограничивает суммарные расходы.
> **Исправление:** `cors({ origin: [<прод-домен фронтенда>, "http://localhost:5173"] })`.
> ✅ Исправлено (commit 7f88a84): `worker/src/index.ts` — `cors({ origin: ["https://rezept-manager.flowgence.de", "http://localhost:5173"] })`.

**[CRIT-5]** `worker/src/routes/importFromUrl.ts:88, 114`
> **Проблема:** Worker делает server-side `fetch()` на URL, полностью заданный клиентом (сам `url`, а также `og:image`/`imageUrl` со страницы), без allowlist протокола/хоста.
> **Почему важно:** Worker превращается в открытый fetch-прокси (SSRF) — можно заставить его слать запросы на произвольные хосты с IP/репутацией Cloudflare.
> **Исправление:** Валидировать `http(s)`-протокол, добавить allowlist или блокировать private/link-local диапазоны.
> ✅ Исправлено (commit b3a2dd6, доп. фикс 7f18feb): `worker/src/helpers/validateExternalUrl.ts` — блокирует не-http(s) протоколы и literal loopback/private/link-local хосты (включая IPv4-mapped IPv6); применена к `url` и обоим fetch кандидатов изображения в `importFromUrl.ts` через `safeFetch()`, который ревалидирует каждый редирект-хоп (`redirect: "manual"`, до 5 хопов) — обход через 3xx на private-хост закрыт. Не защищает от DNS rebinding (Workers не дают синхронный DNS lookup) — оставлено как известное ограничение.

**[CRIT-6]** `worker/src/routes/fillRemaining.ts:14, 28-29`
> **Проблема:** Валидируется только `remaining.calories`. `allergies.length` и `userRecipes.map(...)` используются без проверки на `undefined` — упадёт с `TypeError`, если поля отсутствуют в теле запроса.
> **Почему важно:** Constraint №5 требует, чтобы allergies и recipeLibrary ВСЕГДА присутствовали в fill-remaining запросе — сейчас это гарантируется только доверием к клиенту, на сервере защиты нет.
> **Исправление:** Добавить `Array.isArray(allergies)` и `Array.isArray(userRecipes)` рядом с существующей проверкой, возвращать 400 при нарушении.
> ✅ Исправлено (commit f2786e9): `worker/src/routes/fillRemaining.ts` — добавлены `Array.isArray(allergies)` и `Array.isArray(userRecipes)` в общую проверку входа, 400 при нарушении.

**[CRIT-7]** `worker/src/routes/fillRemaining.ts:71-81`
> **Проблема:** `data.options ?? []` возвращается клиенту без проверки, что Gemini вернул именно 3 варианта — только промпт (строка 34) просит об этом, не гарантия.
> **Почему важно:** Прямое нарушение constraint №5 «ответ — ровно 3 варианта». Gemini может вернуть 0, 1 или 5 вариантов незаметно для приложения.
> **Исправление:** Валидировать `data.options?.length === 3` после парсинга, при нарушении — ошибка или коррекция с логированием.
> ✅ Исправлено (commit e43fd7d): `worker/src/routes/fillRemaining.ts` — при `data.options.length !== 3` логируется `console.error` с фактическим числом вариантов и телом ответа, клиенту возвращается 502. Выбрана ошибка вместо тихой коррекции (обрезка/паддинг сфабрикует несуществующие варианты, что хуже честного отказа).

**[CRIT-8]** `worker/src/index.ts:19-22` + локальные catch-блоки во всех 6 маршрутах
> **Проблема:** Глобальный error handler и большинство маршрутов возвращают `err.message` клиенту как есть (500/502).
> **Почему важно:** Раскрытие внутренних деталей (SDK-ошибки, парсинг) клиенту — информационная утечка, противоречит духу правила «GEMINI_API_KEY и внутренности никогда не должны попадать к клиенту».
> **Исправление:** Логировать полную ошибку на сервере (`console.error`), клиенту возвращать generic-сообщение.

---

## 🟠 Противоречия с документацией

**[DOC-1]** `Technical_Project_Documentation.md:312` vs `STATUS.md`
> Base64-картинки в Firestore помечены «Phase 1 TODO», но STATUS.md говорит «Phase 1 DoD закрыт». Констрейнт фактически не закрыт (см. CRIT-1) — документация вводит в заблуждение.

**[DOC-2]** `Technical_Project_Documentation.md:141`
> `LocalStorageNutritionPlanRepository.ts` описан как активно используемый «localStorage fallback», но в реальности нигде не подключён (см. DEAD-1) — мёртвый код, а не рабочий fallback.

**[DOC-3]** `Technical_Project_Documentation.md:113` vs `src/services/RecipesRepository.ts:3-9`
> Документация: `subscribe, add, update, delete, deleteAll`. Реально: `subscribeAll, add, update, delete, getById`. `deleteAll` не существует, `getById` не задокументирован.

**[DOC-4]** `Technical_Project_Documentation.md:114` vs `src/services/PlannerRepository.ts:3-7`
> Документация обещает `update`, реально интерфейс — `subscribeAll, add, delete`. У `PlannerRepository` **нет метода `update()` вообще**.

**[DOC-5]** `Technical_Project_Documentation.md:116` vs `src/services/ProgramsRepository.ts:3-9`
> `getById` присутствует в коде, но не упомянут в документации.

**[DOC-6]** `Technical_Project_Documentation.md:118` vs `src/services/NutritionPlanRepository.ts:3-6`
> Документация: `subscribe, save`. Реальность: `get(): Promise<ActiveNutritionPlan | null>` / `set(plan): Promise<void>`. Похоже на copy-paste из строки `UserProfileRepository` выше.

**[DOC-7]** `docs/roadmap-archive/phase-1.md:26` vs `firestore.rules:55-58`
> Архивная запись описывает перенос `activeNutritionPlan` в `settings/plan`, но реальная коллекция — `nutritionPlans/{uid}`, а путь `settings/*` в rules явно `deny`-ится (устаревшие данные).

**[DOC-8]** `Application_description.md` («Вкладка Корзина», п.6) vs `src/features/cart/CartView.tsx`
> Подсветка аллергенов в корзине красным цветом с иконкой и текстом «Осторожно: аллерген!» описана в документации, но в `CartView.tsx` нет вообще никакой allergy-логики (grep на «allerg» — пусто).

**[DOC-9]** `Application_description.md` («Вкладка Рецепты», п.3) vs `RecipesView.tsx`
> Кнопка «Пересчитать КБЖУ» под блоком КБЖУ на карточке рецепта отсутствует в коде. Вместо неё — только степпер порций (см. LOGIC-5), который ничего не пересчитывает.

**[DOC-10]** `src/app/layout/AppHeader.tsx:17-79` vs `src/features/settings/SettingsModal.tsx:324-341`
> Два независимых, рассинхронизированных переключателя языка: в AppHeader — чисто визуальный (не вызывает `changeLanguage()`, известная проблема), в SettingsModal — рабочий, вызывает `changeLanguage()` из `I18nProvider`. Раз рабочая реализация уже есть, AppHeader — избыточный и вводящий в заблуждение дубль, а не просто «косметическая» проблема.

**[DOC-11]** `Technical_Project_Documentation.md:204` vs 5 маршрутов worker
> Документация: везде `gemini-2.5-flash`. Реально используется `gemini-3-flash-preview` в `calculateKbzhu.ts:19`, `importFromUrl.ts:37`, `importFromPdf.ts:94,104`, `importFromPhoto.ts:47`, `fillRemaining.ts:64` (комментарий в `importFromPdf.ts:3-6` объясняет осознанный переход). `generateImage.ts` по-прежнему верно использует `gemini-2.5-flash-image`.

**[DOC-12]** `Technical_Project_Documentation.md:179,206` vs `worker/src/middleware/rateLimit.ts:15-16`
> Описано как «Token bucket», реально — счётчик по календарной минуте (`rate:${ip}:${Math.floor(Date.now()/60000)}`). Допускает всплеск до ~20 запросов за 2 секунды на границе минут, чего token bucket не допустил бы.

**[DOC-13]** `Technical_Project_Documentation.md:190` (§5 «Firebase») vs `src/infrastructure/firestore/*.ts`, `firestore.rules`
> Документация называет коллекции `planner_entries`, `cart_items`. Реальные имена — `planner`, `cart` (подтверждено кодом репозиториев, `firestore.rules` и `scripts/migrate-assign-user.ts`).

**[DOC-14]** `CLAUDE.md` («Development conventions») vs репозиторий
> Указано «Prettier (format on save); ESLint», но нигде в репозитории нет ни конфига ESLint (`.eslintrc*`/`eslint.config*`), ни зависимости `eslint` в `package.json`. Заявленный процесс контроля качества фактически не существует.

**[DOC-15]** `.env.example` vs `Technical_Project_Documentation.md:212-225`
> `.env.example` всё ещё содержит `GEMINI_API_KEY` и `APP_URL` — реликты старого AI Studio шаблона (собственный TODO-комментарий в файле призывает их убрать после перехода на Worker-прокси, который уже реализован). Технический документ описывает только `VITE_FIREBASE_*`/`VITE_AI_WORKER_URL`.

---

## 📋 Недокументированная логика

**[UNDOC-1]** `scripts/migrate-assign-user.ts`
> **Проблема:** Скрипт миграции (назначение `userId` на существующие документы + перенос `settings/profile`→`userProfiles`, `settings/plan`→`nutritionPlans`) нигде не упомянут в разделе «Структура файлов» `Technical_Project_Documentation.md`.
> **Действие:** Добавить раздел `scripts/` в техдокументацию с описанием назначения и переменных окружения (`GOOGLE_APPLICATION_CREDENTIALS`, `MIGRATION_USER_UID`).

---

## 🔵 Логические ошибки

**[LOGIC-1]** `FirestoreCartRepository.ts:26-35`, `FirestorePlannerRepository.ts:26-34`, `FirestoreProgramsRepository.ts:36-44`, `FirestoreRecipesRepository.ts:33-41`, `FirestoreUserProfileRepository.ts:10-13`
> Все `onSnapshot(query, onNext)` не передают `onError`. При ошибке подписки (истёкший токен, permission-denied) UI молча замирает на устаревших данных без какого-либо сигнала. Исправление: добавить `onError`-колбэк с логированием/сигналом наверх.

**[LOGIC-2]** `src/infrastructure/firestore/converters.ts:6-7`
> `timestampToISO(null|undefined)` тихо возвращает `new Date().toISOString()`. Документ с реально отсутствующим `createdAt` (артефакт миграции) молча выпрыгивает в начало списка, как будто только что создан, маскируя проблему данных. Исправление: логировать warning вместо тихого дефолта.

**[LOGIC-3]** `src/features/tracker/AISuggestModal.tsx:74-147` + `TrackerView.tsx:89-124,351-433`
> Из-за батчинга React `setSuggestion`/`setIsSuggesting(false)` результаты модалки практически недостижимы в обычном потоке — реальный UI выбора вариантов задублирован инлайн в `TrackerView.tsx`. Модалка — мёртвый вес, поддерживается два места с одинаковой логикой.

**[LOGIC-4]** `src/features/planner/PlannerView.tsx:647`
> Месячный вид считает калории только по `type: 'recipe'`, entries с `type: 'product'` молча игнорируются — тот же день показывает разные суммы в разных видах планера (день/неделя vs месяц).

**[LOGIC-5]** `src/features/recipes/RecipesView.tsx:2499-2526`
> Степпер порций (+/-) меняет только `selectedRecipe.servings` в локальном state; макросы ниже (2436-2461) читаются нескейленными, `recipesRepo.update()` не вызывается — изменение чисто косметическое и теряется при повторном открытии.

**[LOGIC-6]** `worker/src/routes/fillRemaining.ts:33`
> `remaining.proteins/fats/carbs` подставляются в промпт без проверки на число (проверяется только `calories`). При отсутствии полей в промпт улетает буквальная строка `"undefined"`, незаметно портя качество AI-рекомендаций.

**[LOGIC-7]** `worker/src/middleware/rateLimit.ts:18-33`
> Последовательность KV `get`→вычисление→`put` не атомарна — при параллельных запросах с одного IP в одну минуту лимит может быть превышен (мягкое ограничение вместо строгого «11-й запрос → 429»).

**[LOGIC-8]** worker-маршруты в целом
> Идентичные сбои (ошибка Gemini) дают разные коды/формат ответа: `calculateKbzhu.ts`/`generateImage.ts` падают в общий 500-обработчик без локального try/catch, остальные 4 маршрута ловят локально и возвращают 502 с `Gemini error: ...`. Исправление: унифицировать обработку ошибок по всем 6 маршрутам.

**[LOGIC-9]** *(информационная, низкий приоритет)* Ни один репозиторий (`PlannerRepository.add()`, `FirestoreRecipesRepository.add()/update()` и т.д.) не выполняет проверку аллергенов при записи — это архитектурно нормально (проверка живёт в UI-слое), но означает отсутствие defense-in-depth для safety-critical constraint №1: если какой-то будущий вызов пропустит UI-проверку, на уровне хранения её никто не перехватит.

---

## 🟡 Мёртвый / избыточный код

**[DEAD-1]** `src/infrastructure/LocalStorageNutritionPlanRepository.ts` (весь файл)
> Не используется нигде, кроме собственного теста (`grep` подтверждает). `RepositoryProvider.tsx` подключает только `FirestoreNutritionPlanRepository`. См. DOC-2. Удалить или осознанно подключить как задокументированный optimistic cache.

**[DEAD-2]** `src/services/ai/contracts.ts:85`
> `AiErrorResponse` экспортирован, но нигде не импортируется. `aiClient.ts:18-29` игнорирует структурированное тело ошибки от воркера, кидает generic `Error` с сырым текстом. Исправление: парсить как `AiErrorResponse` в `post()` либо удалить неиспользуемый тип.

**[DEAD-3]** `src/infrastructure/testing/Fake{Cart,Planner,Programs,Recipes,UserProfile,NutritionPlan}Repository.ts`
> Почти идентичный boilerplate (`Set<callback>` + `emit()` + `counter` + `reset()`) продублирован в 6 файлах (~15 строк дублирования в каждом). Не срочно, но кандидат на общий generic-базовый класс.

**[DEAD-4]** `src/features/programs/ProgramsView.tsx:7-8,16-18,205`
> Хелпер `cn()` (clsx+tailwind-merge) объявлен и импортирован, но нигде не используется в JSX — вместо удаления добавлена заглушка `void cn;` для подавления lint-предупреждения.

**[DEAD-5]** `src/features/tracker/AISuggestModal.tsx:74-147` — см. LOGIC-3, дублирующая недостижимая UI-логика.

**[DEAD-6]** `src/features/programs/ProgramDetailModal.tsx:249`
> `<AnimatePresence>{true && (...)}</AnimatePresence>` — условие `true &&` никогда не бывает false, бессмысленно.

**[DEAD-7]** `package.json:22` (корень)
> Зависимость `express` объявлена, но нигде не используется во всём репозитории (кроме `package.json`/lock-файла).

**[DEAD-8]** `package.json:17` (корень)
> `@google/genai` объявлена как зависимость фронтенда, но нигде не импортируется в `src/`. Помимо того что это мёртвая зависимость, её присутствие в клиентском `package.json` — риск: кто-то в будущем может импортировать её напрямую с ключом на клиенте, в обход Worker-прокси (Known constraint).

**[DEAD-9]** `src/features/recipes/RecipesView.tsx:2280-2283`
> Кнопка «Поделиться» на карточке рецепта отрендерена без `onClick`-обработчика вообще. В `ProgramsView.tsx` есть рабочий `handleShareProgram` для программ — значит, это не недостроенная фича, а забытый нерабочий контрол.

---

## ⚡ TypeScript strict compliance

**[TS-1]** `fromFirestore()` в `FirestoreCartRepository.ts`, `FirestorePlannerRepository.ts`, `FirestoreProgramsRepository.ts`, `FirestoreRecipesRepository.ts`
> Все поля приводятся через `as Type` без runtime-валидации. Испорченный/частично мигрированный документ типизируется корректно, но по факту содержит `undefined` там, где strict mode обещает обязательную строку/`Macros`. Исправление: лёгкий runtime-валидатор (zod или ручной guard) на границе с Firestore.

**[TS-2]** `FirestoreUserProfileRepository.ts:11`
> `snap.data() as UserProfile` — приведение всего документа целиком, без пофилдовой мапинг-функции (хуже TS-1, вообще нет устойчивости к частичной форме). Привести к паттерну `fromFirestore()`, как у соседей.

**[TS-3]** `src/infrastructure/testing/FakeAuthProvider.tsx:12`
> `({ uid, email: 'test@test.com' } as unknown as FirebaseUser)` — двойной каст через `unknown`, полностью глушит структурную проверку. Приемлемо для тестового фейка, но без комментария о причине; если код начнёт читать `displayName`/`getIdToken`, скомпилируется, но упадёт в рантайме.

**[TS-4]** `src/services/ai/contracts.ts:76-83`
> `FillRemainingResponse.options` типизирован как открытый массив, без constraint «ровно 3». Компилятор не защищает от инварианта constraint №5 (см. CRIT-7 — рантайм-часть той же проблемы).

**[TS-5]** `ProgramDetailModal.tsx:535,756,815,854`; `RecipesView.tsx:1213`
> `(e: any)` для drag-and-drop обработчиков вместо `React.DragEvent<HTMLDivElement>` — теряется типобезопасность `e.dataTransfer`/`e.currentTarget`.

**[TS-6]** `src/vite-env.d.ts`
> `ImportMetaEnv` не объявляет `VITE_AI_WORKER_URL`, хотя переменная используется в `aiClient.ts:16`. Работает благодаря index signature из базового `vite/client`, но теряется автодополнение и защита от опечатки в имени переменной. Добавить объявление для консистентности с остальными `VITE_*`.

**[TS-7]** `scripts/migrate-assign-user.ts` не входит ни в `include` корневого `tsconfig.json` (`"src/**/*"` только), ни в `worker/tsconfig.json`. Скрипт не проходит статическую проверку типов через `npm run lint`/`tsc --noEmit`, полагаясь только на транспиляцию `tsx`. Добавить отдельный `tsconfig` или включить в `include`, если типобезопасность здесь важна.

---

## 🏛️ Соответствие соглашениям

**[CONV-1]** `src/features/recipes/RecipesView.tsx` — 2590 строк
> Один компонент смешивает CRUD рецептов, AI-импорт (фото/PDF/ссылка), фильтрацию, добавление в планер, работу с коллекциями, кроп изображений и 6+ модалок. Сильный кандидат на декомпозицию (`RecipeCard`, `RecipeDetailModal`, `AddRecipeModals`, `useRecipeFilters`).

**[CONV-2]** `ProgramsView.tsx:571`; `ProgramDetailModal.tsx:175,284,1043,1207`
> `Math.random().toString(36).substr(2, 9)` для генерации ID Subfolder/Resource — `substr` deprecated, `Math.random` не даёт устойчивости к коллизиям. Заменить на `crypto.randomUUID()`.

**[CONV-3]** `worker/src/routes/importFromUrl.ts:81-84`
> Блок из 4 однострочных комментариев читается как мини design-doc, а не как объяснение «почему». Незначительный стилистический момент, не дефект.

---

## 🔄 Импорты / зависимости

Нет находок. `src/services/*.ts` не содержит ни одного импорта Firebase — Repository pattern чист для будущей замены на Supabase (Phase 3). Циклических/несуществующих импортов не обнаружено ни в одной из трёх просканированных областей.

---

## 🐢 Производительность

**[PERF-1]** `FirestoreCartRepository.ts:51-54`
> `deleteAll()` шлёт по одному `deleteDoc` через `Promise.all` вместо единого `writeBatch` — нет атомарности, частичный сбой оставляет корзину частично очищенной без отката. Исправление: `writeBatch(db)` (с чанками по 500 при необходимости).

**[PERF-2]** Все `subscribeAll`-запросы (Cart/Planner/Programs/Recipes)
> Нет `limit()`/ограничения по дате — каждый listener ресинкает всю коллекцию пользователя на каждое изменение. Не критично сейчас, но CLAUDE.md целится в «десятки тысяч» пользователей с годами истории планера.

**[PERF-3]** `src/features/recipes/RecipesView.tsx:301-354`
> `filteredRecipes`/`allAuthors`/`allPrograms` пересчитываются на каждый рендер, включая каждую букву в поиске, без `useMemo`.

**[PERF-4]** `src/features/planner/PlannerView.tsx`
> Редьюс подсчёта макросов (задублированный 4×, см. CRIT-3) выполняется инлайн в теле рендера для каждой ячейки дня/приёма пищи; в недельном/месячном виде — внутри вложенных `.map()` (стоимость растёт как дни × приёмы пищи × записи на каждый рендер), без `useMemo`.

**[PERF-5]** `RecipesView.tsx`, `PlannerView.tsx`
> Обработчики `onClick`/`onToggle` не обёрнуты в `useCallback`, карточки/строки списков без `React.memo` — весь список перерендеривается при несвязанных изменениях state родителя (например, открытие фильтра).

**[PERF-6]** `worker/src/routes/importFromUrl.ts:116-117`
> Проверка размера (`buffer.byteLength > 600_000`) выполняется ПОСЛЕ полного `await imgResp.arrayBuffer()` — большое/вредоносное изображение полностью скачивается прежде, чем будет отброшено. Исправление: проверять `Content-Length` до чтения тела, либо стримить с ранним обрывом.

**[PERF-7]** Все 6 маршрутов worker
> Нет timeout на вызовы `generateContent()` и на два `fetch()` в `importFromUrl.ts:88,114`. Зависший upstream-запрос держит воркер без клиентского предела (кроме платформенных лимитов Cloudflare). Исправление: `AbortController` + разумный timeout (20-30с), чистый 504 клиенту.

**[PERF-8]** `worker/src/routes/importFromPhoto.ts`
> В отличие от `importFromUrl.ts` (лимит 600KB на скачиваемые изображения), нет проверки размера клиентских `images[].base64` перед отправкой в Gemini — рост стоимости/задержки без локального guard.

---

## ✅ Категорий без нарушений
🔄 Импорты / зависимости (архитектура Repository pattern полностью чиста от Firebase-зависимостей в `src/services/`)
