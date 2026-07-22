# Аудит кода — отчёт (2026-07-22)

> Скилл `project-audit`. Область: `src/`, `worker/src/`, `scripts/`, конфиги (`firestore.rules`, `storage.rules`, `wrangler.toml`, `tsconfig.json`, `vitest.config.ts`), документация (`Application_description.md`, `Technical_Project_Documentation.md`).

## Сводка

| Категория | Найдено |
|-----------|---------|
| 🔴 Критические нарушения | 2 |
| 🟠 Противоречия с документацией | 6 |
| 📋 Недокументированная логика | 3 |
| 🔵 Логические ошибки | 10 |
| 🟡 Мёртвый / избыточный код | 6 |
| ⚡ TypeScript strict | 4 |
| 🏛️ Соответствие соглашениям | 2 |
| 🔄 Импорты / зависимости | 0 |
| 🐢 Производительность | 1 |
| 🧪 Тестовое покрытие | 5 |
| **Итого** | **39** |

Базовые проверки на момент аудита: `npm run lint` (tsc) — чисто, `npm run lint:eslint` — чисто, 177 фронтенд-тестов + 118 worker-тестов зелёные. Все constraints воркера (SSRF, timeout, `err.message`, KV rate limit) соблюдены — новых нарушений там нет.

---

## Прогресс проработки

> Ledger для возобновления работы в новой сессии. Группировка и обоснование — `docs/plans/2026-07-22-audit-followup-groups.md`.
> Порядок — по риску. Три находки, требующие продуктового решения (LOG-4, DEAD-4, DOC-5), вынесены в финальную группу 12.

| # | Группа | Находки | Статус |
|---|--------|---------|--------|
| 1 | TrackerView (safety-critical) | CRIT-1, LOG-7, PERF-1 | ✅ |
| 2 | PlannerView + App.tsx (safety-critical) | CRIT-2, DEAD-2, LOG-3, TS-4 | ✅ |
| 3 | SettingsModal | TEST-1, LOG-1 | ✅ |
| 4 | ProgramSelectionModal | TEST-2, LOG-2 | ✅ |
| 5 | ProgramDetailModal — обработчики | TEST-3, LOG-5, LOG-6, UNDOC-2 | ✅ |
| 6 | Cart | CONV-1, LOG-8 | ✅ |
| 7 | Чистка пропов programs | DEAD-1, DEAD-3, TS-3 | ✅ |
| 8 | Микрофиксы | LOG-10, TS-1, TS-2, DEAD-6 | ✅ |
| 9 | Инфраструктура | LOG-9, CONV-2 | ✅ |
| 10 | Тестовая конфигурация | DEAD-5, TEST-4, TEST-5 | ✅ |
| 11a | Документация: структура файлов | DOC-1, DOC-2, DOC-3, UNDOC-1 | ✅ |
| 11b | Документация: числа и продукт | DOC-4, DOC-6, UNDOC-3 | ✅ |
| 12 | Спорное: продуктовые решения | LOG-4, DEAD-4, DOC-5 | — |

Статусы: `—` не начата · `в работе` · `✅` закрыта. Отдельные находки помечаются `✅ Исправлено (commit <hash>)` в конце своего блока.

---

## 🔴 Критические нарушения

**[CRIT-1]** `src/features/tracker/TrackerView.tsx:114-139`

> **Проблема:** `handleAddSelectedSuggestions()` записывает выбранные AI-варианты в планер через `plannerRepo.add()` без какой-либо проверки аллергенов. Для `option.type === 'recipe'` рецепт берётся из библиотеки пользователя по `option.recipeId` — `recipeHasAllergens()` не вызывается; для `option.type === 'product'` не вызывается `productAllergens()`.
> **Почему важно:** Прямое нарушение safety-critical constraint №1 CLAUDE.md («Allergy check обязателен перед добавлением рецепта в Planner / **Tracker** / **AI-suggestions**») и Known constraint «Любой новый путь добавления рецепта в Planner/Tracker/AI-suggestions обязан сам вызвать проверку аллергенов в UI/hook-слое — на уровне репозитория её никто не перехватит». Три остальных пути записи в планер (`PlannerView.tsx:118`, `RecipeDetailModal.tsx:88`) гейт имеют — этот единственный его обходит. Передача `allergies` в промпт `fillRemaining` — это доверие к модели, а не детерминированный гейт.
> **Исправление:** Перед циклом `plannerRepo.add()` прогнать каждую выбранную опцию через `recipeAllergens()` (для `type === 'recipe'`) / `productAllergens(option.description)` (для `type === 'product'`) и показать тот же `confirm()`-гейт, что в `PlannerView.handleAddToPlanner()`. Покрыть тестом (сейчас `TrackerView.test.tsx` этот путь не проверяет).
>
> ✅ Исправлено (commit dc302db)

**[CRIT-2]** `src/features/planner/PlannerView.tsx:172-176`, `src/App.tsx:196`

> **Проблема:** `PlannerView` принимает проп `activeNutritionPlan` (объявлен в `PlannerViewProps:53`, передаётся из `App.tsx:196`), но **не деструктурирует и не использует его**. Индикатор превышения лимита считается от `userProfile.targetCalories/targetProteins/targetFats/targetCarbs`. `TrackerView.tsx:72` для тех же данных использует `resolveActiveTargets(activeNutritionPlan, profile)`.
> **Почему важно:** Нарушение constraint №2 («KBZHU consistency — суммы калорий и макросов в Planner, Tracker и Programs должны оставаться синхронными») и №3 («Active program overrides profile goals»). При активной программе «Сушка» (1400 ккал) Планер продолжает подсвечивать красным по цели профиля (1800 ккал): один и тот же день выглядит «в норме» в Планере и «превышено» в Трекере.
> **Исправление:** В `PlannerView` заменить прямое чтение `userProfile.target*` на `resolveActiveTargets(activeNutritionPlan, userProfile)` — функция уже существует и покрыта тестами. Добавить регрессионный тест на согласованность Planner/Tracker при активном плане.
>
> ✅ Исправлено (commit 3479069)

---

## 🟠 Противоречия с документацией

**[DOC-1]** `Technical_Project_Documentation.md:149`

> **Проблема:** В таблице «`src/infrastructure/` — реализации» присутствует строка `LocalStorageNutritionPlanRepository.ts`. Файл удалён при проработке DEAD-1 аудита 2026-07-19; в репозитории его нет.
> **Исправление:** Убрать строку из таблицы.
>
> ✅ Исправлено (commit 7cddd06)

**[DOC-2]** `Technical_Project_Documentation.md:355`

> **Проблема:** В §9 «Что покрыто» тот же несуществующий `src/infrastructure/LocalStorageNutritionPlanRepository.ts` указан как покрытый тестами.
> **Исправление:** Убрать пункт.
>
> ✅ Исправлено (commit 0ffe022)

**[DOC-3]** `Technical_Project_Documentation.md:158`

> **Проблема:** Таблица `src/features/` указывает для `tracker/` файлы «TrackerView.tsx, **AISuggestModal.tsx**, ProgramSelectionModal.tsx». Файла `AISuggestModal.tsx` не существует — вся логика AI-подсказок живёт внутри `TrackerView.tsx` (строки 75-139 и JSX 374-466).
> **Исправление:** Убрать `AISuggestModal.tsx` из таблицы (либо выделить компонент, если декомпозиция планируется).
>
> ✅ Исправлено (commit 9ac6944) — строка `tracker/` приведена к факту, добавлено пояснение, что UI AI-подсказок живёт inline в `TrackerView.tsx`. Декомпозиция не планировалась. Заодно проверено, что таблица `src/features/` отражает файлы, добавленные при проработке этого аудита (`cart/CartItemRow.tsx`, `app/layout/DataErrorBanner.tsx` — уже присутствуют).
>
> ➕ Дополнительно (commit 90b104a): grep выявил **второе** упоминание того же удалённого файла, не указанное в находке — §3 «Data flow» → «AI fill remaining КБЖУ», шаг 4 (`AISuggestModal` → выбор → `plannerRepo.add()`). Приведено к факту: inline-UI подсказок в `TrackerView` → allergy-гейт (`recipeAllergens`/`productAllergens` + `confirm`, добавлен при проработке CRIT-1) → `plannerRepo.add()`.

**[DOC-4]** `Technical_Project_Documentation.md:38,350`

> **Проблема:** Три расходящихся числа тестов: §2 (таблица стека) — «112 тестов»; §9 — «293 теста: 175 фронтенд + 118 worker»; фактический прогон — **295** (177 фронтенд + 118 worker). Там же в §2 указан `@google/genai 1.29`, в `worker/package.json` — `^1.50.1`.
> **Исправление:** Привести §2 и §9 к фактическим числам; версию SDK — к `1.50`.
>
> ✅ Исправлено (commit 98d0946) — после закрытия групп 1-10 фактический прогон дал **401 тест: 283 фронтенд (42 файла) + 118 worker (11 файлов)**; это число вписано и в §2, и в §9 (с указанием даты прогона). `@google/genai` → 1.50. Проверены остальные версии §2 против `package.json`/`worker/package.json` — расхождений больше нет (таблица использует declared-range floor: React 19.0, Vite 6.2, Tailwind 4.1, Firebase 12.9, TS 5.8, vitest 4.1 — всё совпадает); заодно заполнены три прочерка: `hono` 4.8, `motion` 12.23, `pdfjs-dist` 5.4.

**[DOC-5]** `Application_description.md:331` vs `firestore.rules:35-42` `[ambiguous]`

> **Проблема:** Документация обещает: «Поделиться программой: вы можете сгенерировать уникальную ссылку… **Они смогут просматривать вашу коллекцию рецептов и ваши рекомендации**». `firestore.rules` разрешает `read` для `programs` только при `request.auth.uid == resource.data.userId`. Открытие ссылки `?programId=` другим пользователем всегда упирается в permission-denied (`App.tsx:128` → `getById` → `getDoc`). Аналогично `?recipeId=` (`App.tsx:147`) ищет рецепт в uid-scoped массиве — чужой рецепт не найдётся никогда. Шеринг работает только внутри собственного аккаунта.
> **Действие:** Решение продуктовое — либо привести документацию в соответствие с текущим поведением, либо реализовать реальный шеринг (публичные/shared-документы + правила Firestore). Не исправлять автоматически.

**[DOC-6]** `Technical_Project_Documentation.md:167,397`

> **Проблема:** Числовой дрейф: §4 — «`RecipesView.tsx` Оркестратор (333 строки)», фактически 341; §10 — «`App.tsx` < 300 строк… Достигнуто 277», фактически 293.
> **Исправление:** Обновить числа (или убрать точные значения строк, чтобы они не устаревали при каждой правке).
>
> ✅ Исправлено (commit 94b8647). Фактические значения на момент фикса: `RecipesView.tsx` — 341 строка, `App.tsx` — 297 (не 293: в App.tsx с момента аудита добавлены правки LOG-3/TS-4). Решение по двум местам разное: в §4 счёт строк `RecipesView.tsx` **удалён** — он чисто описательный и обречён устаревать при каждой правке; в §10 цель «`App.tsx` < 300 строк» **сохранена** (это цель декомпозиции, терять нельзя), фактическое значение обновлено до 297 с датой и способом проверки (`wc -l src/App.tsx`) и явной пометкой, что запас до порога мал.

---

## 📋 Недокументированная логика

**[UNDOC-1]** `worker/tsconfig.json:19`

> **Проблема:** Воркер — отдельный npm-пакет, но его `include` содержит `"../src/services/ai/contracts.ts"`, и все 6 роутов делают `import type … from '../../../src/services/ai/contracts'`. Это осознанная общая точка контракта фронтенд↔воркер (только типы, рантайм-связи нет), но нигде не описана: §4 TechDoc в таблице `worker/` про это не упоминает.
> **Действие:** Добавить в TechDoc §4 (таблица `worker/`) строку о том, что DTO-контракты не дублируются, а импортируются типами из `src/services/ai/contracts.ts`, и что `worker/tsconfig.json` включает этот файл явно.
>
> ✅ Исправлено (commit f5130f3) — в таблицу `worker/` добавлена строка `tsconfig.json`, под таблицей — абзац «Общий контракт фронтенд↔воркер»: связь только на уровне типов (`import type` стирается на компиляции, рантайм-зависимости и попадания в бандл wrangler нет), `contracts.ts` — единственный источник истины для Request/Response обеих сторон, правка контракта требует прогона typecheck в обоих пакетах.

**[UNDOC-2]** `src/features/programs/ProgramDetailModal.tsx:199-230`

> **Проблема:** `handleSubfolderPdfUpload` создаёт `Resource` с `url: file.name` — файл никуда не загружается (ни Storage, ни Firestore-blob), сохраняется только имя. Пользователю при этом показывается `alert('Файл ${file.name} загружен')`. Ни в `Application_description.md`, ни в TechDoc поведение «PDF-ресурс = только имя файла» не описано.
> **Действие:** Задокументировать фактическое поведение в `Application_description.md` (Программы → ресурсы) либо завести задачу на реальную загрузку в Firebase Storage. Как минимум — поправить текст алерта, он вводит в заблуждение.
>
> ✅ Исправлено (commit 42bb358) — новый раздел «Ресурсы программы (ссылки и документы)» в `Application_description.md` + честный текст алерта. Реальная загрузка в Storage намеренно не реализована — отдельная задача.

**[UNDOC-3]** `src/features/planner/PlannerView.tsx:497-498`

> **Проблема:** Пользователь может добавить произвольный тип приёма пищи (`onMealTypesChange([...mealTypes, newMeal])`). `Application_description.md:174` описывает фиксированный набор: «Весь день разделен на логические блоки: Завтрак, Обед, Ужин и Перекус».
> **Действие:** Описать возможность добавления своих типов трапез в `Application_description.md` (см. также LOG-4 — сейчас они не сохраняются).
>
> ✅ Исправлено (commit de34312) — в разделе «Планер» → «Детальное планирование приемов пищи» набор слотов описан как расширяемый (кнопка «Добавить прием пищи» в режиме «День», дубликаты не добавляются), добавлен явный подпункт «Текущее ограничение»: свои типы не персистятся, после перезагрузки список возвращается к четырем стандартным, а записи планера с пользовательским типом перестают отображаться (не удаляются). Сама LOG-4 не исправлялась — остаётся в группе 12 как продуктовое решение.

---

## 🔵 Логические ошибки

**[LOG-1]** `src/features/settings/SettingsModal.tsx:176,205,218,236,249,262,275`

> **Проблема:** Все 7 числовых полей профиля пишут результат `parseInt`/`parseFloat` без fallback: `age: parseInt(e.target.value)`. Очистка поля даёт `NaN`, который попадает в `userProfile` и далее в `saveUserProfile()` → Firestore.
> **Почему важно:** `NaN` в `targetCalories` разносится по `resolveActiveTargets()` → `remainingMacros()` → прогресс-бары Трекера и лимиты Планера отображают `NaN`, а `Math.min(100, (actual / NaN) * 100)` даёт `NaN` в `style.width`. Восстановить значение можно только повторным вводом.
> **Исправление:** `parseInt(e.target.value) || 0` (как уже сделано в `ProgramSelectionModal.tsx:144`), либо валидация формы перед `saveUserProfile`.
>
> ✅ Исправлено (commit 3502e2a)

**[LOG-2]** `src/features/tracker/ProgramSelectionModal.tsx:313`

> **Проблема:** `{subfolder.targetCalories && (<p>…</p>)}` — при `targetCalories === 0` React отрендерит literal `0` вместо ничего.
> **Исправление:** Тернарник или явная проверка, как в строке 244 того же файла (`program.targetCalories ? (…) : (…)`).
>
> ✅ Исправлено (commit c0d622c)

**[LOG-3]** `src/App.tsx:127-139`

> **Проблема:** `handleSharedProgram()` — async-функция, вызванная без `await`, `void` и без `.catch()`. `programsRepo.getById()` при отказе Firestore-правил (см. DOC-5) отклоняется → unhandled promise rejection, пользователь не видит ни «Программа не найдена», ни ошибки.
> **Исправление:** Обернуть в `void handleSharedProgram().catch(…)` с показом сообщения пользователю.
>
> ✅ Исправлено (commit cd3dc87)

**[LOG-4]** `src/App.tsx:74`

> **Проблема:** `mealTypes` живёт в `useState` без персистенции, в отличие от соседнего `availableCategories` (строки 35-60, 159-161 — localStorage). Добавленный пользователем тип трапезы (`PlannerView.tsx:498`) исчезает при перезагрузке, а записи планера с этим `mealType` перестают отображаться: `PlannerView.tsx:289,537,802,848` и `TrackerView.tsx:272` рендерят только `mealTypes.map(...)` — записи становятся невидимыми, оставаясь в Firestore и продолжая считаться в суммах КБЖУ.
> **Исправление:** Персистить `mealTypes` тем же способом, что `availableCategories` (а лучше — в профиле пользователя, раз это пользовательская настройка), либо рендерить «прочие» типы трапез отдельной группой.

**[LOG-5]** `src/features/programs/ProgramDetailModal.tsx:216,225`

> **Проблема:** `void programsRepo.update(...)` — fire-and-forget запись без `await` и без `.catch()`, сразу за ней безусловный `alert('Файл … загружен')`. При отказе записи пользователь получает подтверждение успеха несостоявшейся операции.
> **Исправление:** Сделать обработчик async, `await` + try/catch, алерт — только в ветке успеха.
>
> ✅ Исправлено (commit 4e407fc)
>
> ⚠️ Попутно обнаружено: вся ветка `if (activeResourceForm)` (и модалка «Добавить документ/ссылку», строки 1481-1600) — **мёртвый код**: `setActiveResourceForm` нигде не вызывается с непустым значением, состояние всегда `null`. Фикс применён «на будущее», но юнит-тестом ветка не покрывается — запись в TechDoc §9 «Нетестируемые сценарии». Кандидат в отдельную DEAD-находку следующего аудита: либо подключить кнопку открытия формы ресурсов, либо удалить ветку и модалку.

**[LOG-6]** `src/features/programs/ProgramDetailModal.tsx:305-317`

> **Проблема:** Inline `onClick={async () => { await programsRepo.update(...); setOpenSubfolderId(...); }}` без try/catch — при ошибке создания подпапки unhandled rejection, UI молча не меняется.
> **Исправление:** Вынести в именованный обработчик с try/catch (как сделано в `handleSaveEdit` рядом).
>
> ✅ Исправлено (commit 19e3860)

**[LOG-7]** `src/features/tracker/TrackerView.tsx:159`

> **Проблема:** `{userProfile?.waterGoal} мл` — без fallback на `DEFAULT_PROFILE`, хотя строкой выше (72) для целей КБЖУ используется `userProfile ?? DEFAULT_PROFILE`. Пока профиль не загружен, рендерится «Твоя цель:  мл».
> **Исправление:** Ввести локальную `const profile = userProfile ?? DEFAULT_PROFILE` и использовать её везде в компоненте (строки 159 и 163).
>
> ✅ Исправлено (commit b83aceb)

**[LOG-8]** `src/features/cart/CartView.tsx:140,142,144,146,162,170`

> **Проблема:** Шесть операций записи в корзину (`toggleCartItem`, `deleteCartItem`, `updateCartItemAmount`, `clearCart`, `handleAddManualCartItem`) возвращают промисы, которые нигде не обрабатываются. Ни одна не имеет try/catch. Отказ Firestore → unhandled rejection и молчаливая потеря действия пользователя.
> **Исправление:** try/catch с сообщением об ошибке, по образцу `ProgramDetailModal.addProductsToCart` (строки 96-125).
>
> ✅ Исправлено (commit d8d0db0)

**[LOG-9]** `src/app/providers/DataProvider.tsx:19-22`

> **Проблема:** Все четыре `subscribeAll(setX)` вызываются без второго аргумента `onError`, хотя репозитории его поддерживают (`FirestoreProgramsRepository.ts:64-68`). Ошибка подписки (истёкший токен, отзыв прав) попадает только в `console.error` — UI показывает пустые списки, неотличимые от «данных нет».
> **Исправление:** Пробросить `onError` в состояние ошибки контекста и показывать баннер вместо пустого состояния.
>
> ✅ Исправлено (commit ef4407d)

**[LOG-10]** `src/features/recipes/RecipeDetailModal.tsx:84-85`

> **Проблема:** `navigator.clipboard.writeText(shareUrl)` без `await`/`.catch()`, сразу следом безусловный `alert('Ссылка скопирована в буфер обмена!')`. В небезопасном контексте или при отказе в разрешении промис отклоняется, а пользователю сообщают об успехе.
> **Исправление:** `await` + try/catch, алерт только при успехе.
>
> ✅ Исправлено (commit e9880bb)

---

## 🟡 Мёртвый / избыточный код

**[DEAD-1]** `src/features/programs/ProgramDetailModal.tsx:63-73`, `src/features/programs/ProgramsView.tsx:1126-1136`, `src/App.tsx:231-242`

> **Проблема:** Семь пропов — `recipeTarget`, `onRecipeTargetCleared`, `isAddingManual`, `isAddingLink`, `isAddingPDF`, `isScanning`, `onIsScanningChange` — объявлены в `ProgramDetailModalProps`, прокинуты по цепочке `App → ProgramsView → ProgramDetailModal`, но в самом `ProgramDetailModal` не деструктурируются (строки 78-92) и не читаются через `props.` (обращений `props.` в файле нет вообще). Живой prop-drilling через три уровня в никуда.
> **Исправление:** Убрать семь пропов из типа и из места передачи в `ProgramsView.tsx`.
>
> ✅ Исправлено (commit 290f9f8)

**[DEAD-2]** `src/features/planner/PlannerView.tsx:53-55`

> **Проблема:** `activeNutritionPlan`, `checkedEntries`, `onCheckedEntriesChange` объявлены в `PlannerViewProps` и передаются из `App.tsx:196-198`, но не деструктурируются в компоненте.
> **Исправление:** `activeNutritionPlan` — начать использовать (см. CRIT-2, это не удаление, а починка); `checkedEntries`/`onCheckedEntriesChange` — удалить, если Планер действительно не должен отмечать съеденное.
>
> ✅ Исправлено (commit 6550ee4)

**[DEAD-3]** `src/features/programs/ProgramDetailModal.tsx:128`

> **Проблема:** `const [, setEditingSubfolderId] = useState<string | null>(null);` — значение состояния не читается нигде, сеттер вызывается один раз (строка 316). Состояние существует, но ни на что не влияет.
> **Исправление:** Удалить состояние и вызов сеттера.
>
> ✅ Исправлено (commit c63fc63)

**[DEAD-4]** `src/App.tsx:289`

> **Проблема:** `onCategoryRemoved={() => {}}` — `SettingsModal.tsx:110` вызывает этот колбэк при удалении категории, а обработчик пустой. Проп существует только чтобы удовлетворить тип.
> **Исправление:** Либо реализовать (снять удалённую категорию с рецептов, которые её используют), либо убрать проп из `SettingsModal`.

**[DEAD-5]** `vitest.config.ts:19`

> **Проблема:** В `coverage.include` перечислен `'src/infrastructure/LocalStorageNutritionPlanRepository.ts'` — файл удалён (см. DOC-1).
> **Исправление:** Убрать строку.
>
> ✅ Исправлено (commit 62ee52b)

**[DEAD-6]** `worker/src/routes/importFromPdf.ts:106`

> **Проблема:** Отладочный `console.log('[importFromPdf] text path, chars:', pdfText.length)` — единственный `console.log` во всём продакшн-коде (остальное — `console.error`).
> **Исправление:** Удалить.
>
> ✅ Исправлено (commit 51522f9)

---

## ⚡ TypeScript strict

**[TS-1]** `src/shared/utils/pdfUtils.ts:26-27`

> **Проблема:** `await (page as any).render({...}).promise` под `// eslint-disable-next-line @typescript-eslint/no-explicit-any` без объяснения, почему нужен `any` (несовпадение типов `RenderParameters` в `pdfjs-dist` 5.x).
> **Исправление:** Добавить обоснование в комментарий рядом с disable либо типизировать через реальный тип pdfjs.
>
> ✅ Исправлено (commit b6b5dea)

**[TS-2]** `src/shared/utils/pdfUtils.ts:56-57`

> **Проблема:** `content.items.map((item: any) => item.str)` — явный `any` на параметре; `TextItem` из `pdfjs-dist` даёт `.str` типизированно.
> **Исправление:** `(item) => ('str' in item ? item.str : '')` с типом `TextItem | TextMarkedContent`.
>
> ✅ Исправлено (commit 7b08cb2)

**[TS-3]** `src/features/programs/ProgramDetailModal.tsx:264`

> **Проблема:** `programsRepo.update(editingEntity.programId!, …)` — non-null assertion без предшествующего guard. `programId` опционален в типе `editingEntity` (строка 132), и для `type === 'subfolder'` его отсутствие приведёт к `update(undefined)`.
> **Исправление:** Явная проверка `if (!editingEntity.programId) return;` вместо `!`.
>
> ✅ Исправлено (commit 003439b)

**[TS-4]** `src/App.tsx:35-43`

> **Проблема:** `JSON.parse(savedCategories)` возвращает `any` и без валидации присваивается в `useState<string[]>`. Испорченный localStorage (например `{"a":1}`) даст не-массив, и `availableCategories.map/includes` упадёт в рантайме.
> **Исправление:** Проверить `Array.isArray(parsed) && parsed.every(x => typeof x === 'string')` перед возвратом.
>
> ✅ Исправлено (commit bd5ffc9)

---

## 🏛️ Соответствие соглашениям

**[CONV-1]** `src/features/cart/CartView.tsx:23,118`

> **Проблема:** Два компонента в одном файле — `CartItemRow` (23-111) и `CartView` (118-259). CLAUDE.md → Development conventions: «Один компонент на файл». Прецедент в проекте уже есть: `RecipeCard.tsx` вынесен из `RecipesView.tsx` при проработке CONV-1 прошлого аудита.
> **Исправление:** Вынести `CartItemRow` в `src/features/cart/CartItemRow.tsx`.
>
> ✅ Исправлено (commit 0a4873a)

**[CONV-2]** `src/shared/domain/macros.ts:67`

> **Проблема:** `resolveActiveTargets()` возвращает `name: 'По умолчанию (из настроек)'` — русская UI-строка в доменном слое, про который TechDoc §3 говорит «нет внешних зависимостей». Строка рендерится в Трекере (`TrackerView.tsx:176`) и не поддаётся переводу через i18n.
> **Исправление:** Возвращать ключ (`'targets.default'`) или `null`, а человекочитаемое имя резолвить в UI-слое.
>
> ✅ Исправлено (commit e9a5a99) — домен возвращает `name: null`, подпись резолвит `DEFAULT_PLAN_LABEL` в `TrackerView` (i18n Трекера — отдельная задача).

---

## 🐢 Производительность

**[PERF-1]** `src/features/tracker/TrackerView.tsx:67-73`

> **Проблема:** `todayEntries` (filter по всем записям планера), `checkedEntriesData` (второй filter), `actualMacros` (`sumMacros` по всем рецептам) пересчитываются на каждый рендер — включая рендеры от `isSuggesting`, `selectedSuggestionIds`, открытия модалки выбора программы. При «годах истории планера» (сценарий из PERF-2 в roadmap) это полный проход по коллекции на каждый клик чекбокса.
> **Исправление:** `useMemo` на `todayEntries`/`actualMacros` с зависимостями `[plannerEntries, today]` и `[checkedEntriesData, recipes]` — по образцу `entriesByDate` в `PlannerView.tsx:150`.
>
> ✅ Исправлено (commit d8caab2)

> Отложенные PERF-2 (`subscribeAll` без `limit()`) и PERF-5-остаток (`PlannerEntryCard`) из отчёта 2026-07-19 по-прежнему актуальны, но как новые находки не переоткрываются — они уже висят в «Техническом долге» `ROADMAP.md`.

---

## 🧪 Тестовое покрытие

**[TEST-1]** `src/features/settings/SettingsModal.tsx` (530 строк, тестов нет)

> **Проблема:** Единственное место, где пользователь редактирует список аллергий — то есть вход для safety-critical constraint №1 — не покрыто ни одним тестом. Не покрыты также сохранение профиля, удаление категорий, смена языка, выход из аккаунта. В «Нетестируемых сценариях» TechDoc §9 файл не значится, то есть это пробел, а не осознанное решение.
> **Исправление:** RTL-тесты: toggle аллергии → `saveUserProfile` получает обновлённый массив; LOG-1 (очистка числового поля) как регрессионный тест.
>
> ✅ Исправлено (commit 4af85bb) — регрессионный тест на LOG-1 добавлен вместе с самим фиксом LOG-1.

**[TEST-2]** `src/features/tracker/ProgramSelectionModal.tsx` (337 строк, тестов нет)

> **Проблема:** Компонент устанавливает активный план питания (`setActivePlan`) — механизм, на котором держится constraint №3 «Active program overrides profile goals». Не покрыт: ни выбор программы, ни выбор подпапки с наследованием КБЖУ (`subfolder.targetCalories ?? program.targetCalories ?? userProfile.targetCalories ?? 0`, строки 270-297), ни сброс на «По умолчанию».
> **Исправление:** Тесты на цепочку наследования целей и на LOG-2.
>
> ✅ Исправлено (commit 9d15b29) — тест на LOG-2 добавлен вместе с самим фиксом LOG-2.

**[TEST-3]** `src/features/programs/ProgramDetailModal.tsx` (1662 строки — крупнейший файл проекта, тестов нет)

> **Проблема:** Не покрыты drag-n-drop перенос рецептов между подпапками (`handleDropRecipe`, 167-197), редактирование целей программы/подпапки (`handleSaveEdit`, 232-271), добавление продуктов в корзину (`addProductsToCart`, 96-125). Соседний `ProgramsView.tsx` тесты имеет.
> **Исправление:** Как минимум smoke-тест + тест `handleDropRecipe` (чистая функция преобразования массивов, легко изолируется).
>
> ✅ Исправлено (commit 693723f) — 12 тестов в `src/features/programs/__tests__/ProgramDetailModal.test.tsx`.

**[TEST-4]** `vitest.config.ts:13-25`

> **Проблема:** `coverage.include` — allowlist, отставший от реального покрытия. В нём нет `src/features/recipes/**` (при существующих тестах на `RecipeCard`, `RecipesView`, `RecipeDetailModal`, `AddRecipeModals`, `useRecipeFilters`), `src/features/cart/CartView.tsx`, `src/features/auth/**`, `src/features/planner/**`, `src/features/tracker/**`, `src/infrastructure/firebaseStorage.ts` (тест есть — `src/infrastructure/__tests__/firebaseStorage.test.ts`). `npm run test:coverage` рапортует по устаревшему подмножеству и не показывает реальных дыр.
> **Исправление:** Заменить allowlist на `src/**` с `exclude` для заведомо непокрываемого (`main.tsx`, `firebaseApp.ts`, `test-setup.ts`) — тогда пробелы TEST-1..3 станут видны в отчёте.
>
> ✅ Исправлено (commit f2a67ab) — фактическое покрытие по всему `src/` после расширения: statements 47.43% (945/1992), branches 44.65% (631/1413), functions 41.32% (312/755), lines 47.35% (878/1854).

**[TEST-5]** Презентационные модули без тестов (низкий приоритет)

> **Проблема:** `RecipesToolbar.tsx`, `RecipeFilterSidebar.tsx`, `RecipesEmptyState.tsx`, `AppHeader.tsx`, `Shell.tsx`, `RecipeSelectionBar.tsx`, `useAuth.ts`, `RepositoryProvider.tsx`, `I18nProvider.tsx` — экспортируемый код без co-located тестов и без записи в «Нетестируемых сценариях».
> **Исправление:** Либо smoke-тесты, либо явная запись в TechDoc §9, что тонкие презентационные обёртки покрываются транзитивно через тесты родителей.
>
> ✅ Исправлено (commit 80e14a5) — тесты написаны для `useAuth`, `RepositoryProvider`, `I18nProvider`, `AppHeader`, `RecipeSelectionBar`, `RecipesEmptyState`; `Shell`, `RecipesToolbar` и `RecipeFilterSidebar` осознанно оставлены без своих тестов с причиной в TechDoc §9. Покрытие после группы 10: statements 48.99% (976/1992), branches 45.93% (649/1413), functions 43.97% (332/755), lines 49.02% (909/1854).

---

## ✅ Категорий без нарушений

- **🔄 Импорты / зависимости** — циклов нет, неиспользуемых импортов нет (eslint чист), все используемые пакеты присутствуют в `package.json`. Кросс-пакетный `import type` воркера из `src/services/ai/contracts.ts` корректен и явно объявлен в `worker/tsconfig.json` (задокументировать — UNDOC-1).
- **Constraints воркера** — SSRF (`validateExternalUrl`/`safeFetch`), таймауты (`AbortSignal.timeout` на всех 6 роутах + каждом redirect-хопе), отсутствие утечки `err.message`, KV rate limit — все соблюдены, обходов не найдено.
- **Constraint №4** (Firestore как источник истины) и **CRIT-1 прошлого аудита** (base64 в Firestore) — соблюдены: `resolveImageField()` подключён во всех путях записи `image`/`subfolders[].image`.
- **Constraint №5** (`fillRemaining`) — соблюдён полностью: промпт включает remaining, аллергии, allowed/forbidden активной программы и библиотеку рецептов; ответ валидируется на ровно 3 варианта (`worker/src/routes/fillRemaining.ts:96-105`).
- **`firestore.rules` / `storage.rules`** — uid-скоупинг корректен, старые пути `settings/*` закрыты, Storage ограничен размером и content-type.
