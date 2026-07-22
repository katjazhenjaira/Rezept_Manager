# План проработки аудита 2026-07-22 — группировка на 13 сессий

## Context

Аудит `docs/audits/2026-07-22-project-audit-report.md` дал 39 находок. `CLAUDE.md` → «Проработка отчётов аудита» требует обрабатывать их **по одной**: находка → фикс → тесты → отдельный коммит со ссылкой на ID → отметка в отчёте. При 39 находках это заведомо несколько сессий, и наивный порядок «сверху вниз по отчёту» неэффективен: находки одного файла разбросаны по разным категориям, из-за чего один и тот же файл (например `ProgramDetailModal.tsx` — 1662 строки) пришлось бы загружать в контекст 4–5 раз.

Цель плана — разбить 39 находок на группы так, чтобы:
1. **каждая группа = один загруженный набор файлов** (правки одного файла делаются подряд, файл читается один раз);
2. **группа не превышала ~4 находок**, чтобы при исчерпании лимита в середине работы потери были минимальны;
3. **в любой момент был восстановим статус** — новая сессия должна за один взгляд понять, где остановились, не перечитывая отчёт целиком.

Порядок групп — **по риску** (safety → потеря данных → чистка → документация), выбран пользователем. Три находки, требующие продуктового решения, а не фикса (**LOG-4**, **DEAD-4**, **DOC-5**), вынесены в финальную группу — чтобы 36 бесспорных находок закрылись без единой остановки на вопрос.

## Механизм сохранения статуса

Ledger проработки — **сам файл отчёта**, как требует `CLAUDE.md`:

- после каждого коммита в конец находки дописывается `✅ Исправлено (commit <hash>)`;
- пункт `- [ ] Проработать отчёт аудита…` в `ROADMAP.md` → «Технический долг» **не снимается**, пока не закрыты все 39;
- `STATUS.md` при завершении сессии называет **номер текущей группы и следующую находку**.

**Дополнительно к текущему процессу:** в начало файла отчёта добавляется таблица «Прогресс проработки» — 13 строк по числу групп со статусом (`—` / `в работе` / `✅`). Это единственное, что новой сессии нужно прочитать, чтобы продолжить; без неё пришлось бы сканировать все 39 находок в поисках непомеченных.

## Группы

Порядок внутри группы важен там, где отмечено. Каждая находка = отдельный коммит.

### Гр. 1 — TrackerView (safety-critical) · 3 находки
`src/features/tracker/TrackerView.tsx` (476), `src/features/tracker/__tests__/TrackerView.test.tsx`
- **CRIT-1** — allergy-гейт перед `plannerRepo.add()` в `handleAddSelectedSuggestions` (114-139)
- **LOG-7** — `userProfile ?? DEFAULT_PROFILE` вместо `userProfile?.waterGoal` (159, 163)
- **PERF-1** — `useMemo` на `todayEntries` / `actualMacros` (67-73)

Переиспользовать: `recipeAllergens`/`productAllergens` (`src/shared/domain/allergies.ts`), паттерн `confirm()`-гейта из `PlannerView.handleAddToPlanner` (118-137), `DEFAULT_PROFILE` (`src/shared/domain/defaults.ts`), готовый harness с моками репозиториев в `TrackerView.test.tsx` (строки 1-110) — новый тест на CRIT-1 не требует своей инфраструктуры.

### Гр. 2 — PlannerView + App.tsx (safety-critical) · 4 находки
`src/features/planner/PlannerView.tsx` (читать точечно: 50-60, 118-180), `src/App.tsx` (293), `src/features/planner/__tests__/PlannerView.test.tsx`
- **CRIT-2** — `resolveActiveTargets(activeNutritionPlan, userProfile)` вместо `userProfile.target*` (172-176)
- **DEAD-2** — убрать `checkedEntries`/`onCheckedEntriesChange` из `PlannerViewProps` и из `App.tsx:197-198`
- **LOG-3** — `void handleSharedProgram().catch(…)` (`App.tsx:139`)
- **TS-4** — валидация `JSON.parse` для `availableCategories` (`App.tsx:35-43`)

Переиспользовать: `resolveActiveTargets` (`src/shared/domain/macros.ts:51`) — уже покрыта тестами. CRIT-2 делать **первым**: DEAD-2 меняет тот же тип пропов, и `activeNutritionPlan` должен остаться (он становится используемым), а `checkedEntries` — уйти.

### Гр. 3 — SettingsModal · 2 находки
`src/features/settings/SettingsModal.tsx` (530), новый `src/features/settings/__tests__/SettingsModal.test.tsx`
- **TEST-1** — создать тест-файл (toggle аллергии → `saveUserProfile`, сохранение профиля) — **делать первым**, он даёт красный тест для LOG-1
- **LOG-1** — `parseInt/parseFloat` → `|| 0` в 7 полях (176, 205, 218, 236, 249, 262, 275)

Образец фикса уже в проекте: `ProgramSelectionModal.tsx:144`.

### Гр. 4 — ProgramSelectionModal · 2 находки
`src/features/tracker/ProgramSelectionModal.tsx` (337), новый `__tests__/ProgramSelectionModal.test.tsx`
- **TEST-2** — тесты на цепочку наследования КБЖУ `subfolder ?? program ?? profile ?? 0` (270-297) и сброс на «По умолчанию»
- **LOG-2** — `{subfolder.targetCalories && …}` → тернарник (313), образец рядом в строке 244

### Гр. 5 — ProgramDetailModal, обработчики · 4 находки
`src/features/programs/ProgramDetailModal.tsx` — **читать только 96-330**, все четыре находки в этом диапазоне; новый `__tests__/ProgramDetailModal.test.tsx`
- **TEST-3** — тесты на `handleDropRecipe` (167-197), `handleSaveEdit` (232-271), `addProductsToCart` (96-125)
- **LOG-5** — `void programsRepo.update()` → `await` + try/catch, alert только при успехе (216, 225)
- **LOG-6** — inline async `onClick` создания подпапки → именованный обработчик с try/catch (305-317)
- **UNDOC-2** — задокументировать в `Application_description.md`, что PDF-ресурс хранит только имя файла; поправить вводящий в заблуждение текст алерта

Образец try/catch — `addProductsToCart` в том же файле (96-125).

### Гр. 6 — Cart · 2 находки
`src/features/cart/CartView.tsx` (259), `src/features/cart/__tests__/CartView.test.tsx`
- **CONV-1** — вынести `CartItemRow` (23-111) в `src/features/cart/CartItemRow.tsx` — **делать первым**, дальше LOG-8 правит только `CartView`
- **LOG-8** — try/catch на 6 операций записи (140, 142, 144, 146, 162, 170)

Прецедент декомпозиции: `RecipeCard.tsx`, вынесенный из `RecipesView.tsx` (CONV-1 прошлого аудита).

### Гр. 7 — Чистка пропов programs · 3 находки
`src/features/programs/ProgramDetailModal.tsx` (точечно: 63-73, 128, 264), `src/features/programs/ProgramsView.tsx` (1126-1136), `src/App.tsx` (231-242)
- **DEAD-1** — убрать 7 неиспользуемых пропов из типа и из мест передачи
- **DEAD-3** — удалить `const [, setEditingSubfolderId]` (128) и вызов сеттера (316)
- **TS-3** — `editingEntity.programId!` → явный guard (264)

Отделено от Гр. 5 намеренно: здесь только механические правки по точным координатам, большой файл целиком читать не нужно.

### Гр. 8 — Микрофиксы · 4 находки
Четыре независимых файла, диффы по 1-3 строки
- **LOG-10** — `navigator.clipboard.writeText` + await/try-catch (`RecipeDetailModal.tsx:84`)
- **TS-1** — обоснование к `eslint-disable` над `(page as any)` (`pdfUtils.ts:26`)
- **TS-2** — типизация `content.items.map((item: any) …)` (`pdfUtils.ts:57`)
- **DEAD-6** — удалить отладочный `console.log` (`worker/src/routes/importFromPdf.ts:106`)

Существующий тест `src/shared/utils/__tests__/pdfUtils.test.ts` должен остаться зелёным; DEAD-6 требует прогона `npm --prefix worker test`.

### Гр. 9 — Инфраструктура · 2 находки
`src/app/providers/DataProvider.tsx` (29), `src/app/providers/DataContext.ts` (20), `src/shared/domain/macros.ts` (75)
- **LOG-9** — пробросить `onError` в 4 подписки и добавить поле ошибок в `DataState`. Интерфейсы репозиториев **уже** принимают `onError?` (`src/services/*Repository.ts`) — правок в infrastructure не требуется. Поле делать опциональным, чтобы не ломать существующие потребители `useData()`
- **CONV-2** — убрать русскую UI-строку `'По умолчанию (из настроек)'` из `resolveActiveTargets` (`macros.ts:67`)

⚠️ По CONV-2 **не втягивать Трекер в i18n**: `TrackerView` не подключён к `useTranslation` (переведены только `TabBar`, `AppHeader`, `SettingsModal`). Минимальный корректный фикс — вернуть из домена нейтральный маркер (`null` или ключ) и резолвить подпись в UI-слое, оставив домен чистым. Полная i18n Трекера — отдельная задача, не эта находка. Обновить `macros.test.ts`.

### Гр. 10 — Тестовая конфигурация · 3 находки
`vitest.config.ts` (35), `Technical_Project_Documentation.md` §9
- **DEAD-5** — убрать несуществующий `LocalStorageNutritionPlanRepository.ts` из `coverage.include` (19)
- **TEST-4** — заменить allowlist на `src/**` + `exclude` для непокрываемого (`main.tsx`, `firebaseApp.ts`, `test-setup.ts`)
- **TEST-5** — презентационные модули: либо smoke-тесты, либо явная запись в «Нетестируемые сценарии» с причиной

TEST-4 делать **после** Гр. 1-9: расширенный coverage-отчёт должен отражать уже написанные тесты, иначе цифры придётся пересматривать дважды.

### Гр. 11a — Документация: структура файлов · 4 находки
`Technical_Project_Documentation.md` §4, §9
- **DOC-1** — убрать `LocalStorageNutritionPlanRepository.ts` из таблицы (149)
- **DOC-2** — убрать его же из «Что покрыто» (355)
- **DOC-3** — убрать несуществующий `AISuggestModal.tsx` (158)
- **UNDOC-1** — описать shared-контракт: `worker/tsconfig.json` включает `../src/services/ai/contracts.ts`, роуты импортируют типы оттуда

### Гр. 11b — Документация: числа и продуктовое описание · 3 находки
`Technical_Project_Documentation.md` §2/§9/§10, `Application_description.md`
- **DOC-4** — привести числа тестов (§2 «112» и §9 «293») к факту и версию `@google/genai` к 1.50
- **DOC-6** — числовой дрейф `RecipesView` (333→341) и `App.tsx` (277→293)
- **UNDOC-3** — описать возможность добавления своих типов приёмов пищи

DOC-4 делать **последним из всех групп по коду**: число тестов меняется каждой группой, ранняя правка сразу устареет.

### Гр. 12 — Спорное: три продуктовых решения · 3 находки
Требуют ответа пользователя перед фиксом; фиксировать решения в `docs/roadmap-archive/decisions-log.md`
- **LOG-4** — `mealTypes` не персистятся, записи планера с кастомным типом становятся невидимыми. Варианты: localStorage (как `availableCategories`), поле в профиле пользователя, или запретить кастомные типы
- **DEAD-4** — `onCategoryRemoved={() => {}}`: реализовать снятие категории с рецептов или убрать проп
- **DOC-5** — шеринг программ между пользователями не работает (`firestore.rules` пускает только владельца). Варианты: привести `Application_description.md` к факту или реализовать реальный шеринг

## Верификация

**После каждой находки** (перед коммитом), согласно TDD-разделу `CLAUDE.md`:
```bash
npm test                 # фронтенд
npm --prefix worker test # воркер (обязательно для Гр. 8 / DEAD-6)
npm run lint             # tsc --noEmit
npm run lint:eslint      # должен остаться чистым
```
Коммит только на зелёном. Базовая линия на старте: 177 + 118 = 295 тестов, tsc и eslint чисты.

**Проверка safety-фиксов вручную** (Гр. 1-2, юнит-тестами не покрывается полностью):
1. `npm run dev`, войти, добавить в профиль аллерген, совпадающий с ингредиентом рецепта.
2. Трекер → «Заполнить остаток КБЖУ» → выбрать вариант-рецепт с аллергеном → **должен появиться confirm-гейт** (CRIT-1).
3. Трекер → выбрать программу с КБЖУ, отличными от профиля → перейти в Планер → **индикатор превышения должен считаться от целей программы**, совпадая с Трекером (CRIT-2).

**После закрытия всех 13 групп:** прогнать `npm run test:coverage` с обновлённым `include` (Гр. 10), убедиться что числа в `Technical_Project_Documentation.md` §9 совпадают с фактическим прогоном, и только тогда снять пункт из `ROADMAP.md` → «Технический долг».
