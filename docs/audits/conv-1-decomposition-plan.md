# CONV-1: декомпозиция RecipesView.tsx

> Статус выполнения — см. `STATUS.md` → «Следующий шаг». Этот файл — сам план (контекст, принципы, порядок шагов), не журнал прогресса.

## Контекст

Это находка **CONV-1** из `docs/audits/2026-07-19-project-audit-report.md`:

> `src/features/recipes/RecipesView.tsx` — 2590 строк. Один компонент смешивает CRUD рецептов, AI-импорт (фото/PDF/ссылка), фильтрацию, добавление в планер, работу с коллекциями, кроп изображений и 6+ модалок. Сильный кандидат на декомпозицию (`RecipeCard`, `RecipeDetailModal`, `AddRecipeModals`, `useRecipeFilters`).

Файл сейчас — **2617 строк** (чуть вырос после Prettier-форматирования в DOC-14), единственный компонент такого размера в проекте без единого разбиения (для сравнения: `ProgramsView.tsx` уже разбит на `ProgramsView.tsx` + `ProgramDetailModal.tsx`; `PlannerView.tsx` — второй такой же монолит, но не в скоупе этой находки).

**Это чистый рефакторинг** — декомпозиция без изменения поведения. Теста на `RecipesView` нет вообще (проверено grep), поэтому опираемся на typecheck + eslint + `vitest run` (остальной сюит) + `npm run build` + ручной smoke-test чек-лист по каждому шагу, а не на автотесты, которых для этого файла не существует.

## Принцип размещения состояния

Чтобы не изобретать решение по каждому `useState` заново во время реализации, применяется одно правило:

> **Состояние остаётся локальным в том новом файле, который владеет всеми его чтениями и записями. Если состояние *пишется* в одном новом файле, а *читается/рендерится* в файле-соседе — оно поднимается в `RecipesView.tsx`** (зеркалит существующий паттерн `App.tsx` → `RecipesView`/`ProgramsView`).

## Итоговый список файлов

Все — новые sibling-файлы в `src/features/recipes/` (в проекте нет `hooks/`-подпапки нигде — единственный существующий хук, `useAuth.ts`, лежит рядом с `AuthProvider.tsx`; повторяем этот паттерн, не вводим новую структуру).

### 1. `RecipesView.tsx` (слимминг-оркестратор, ~250–350 строк)
Остаётся: `RecipesViewProps` (без мёртвого `selectionTarget`), состояние формы add/edit (`formData`, `editingId`, `productFormData`, `isAddingProductToRecipe`, `recipeLink`, `isDeleteConfirmOpen` — пишутся в `AddRecipeModals`, читаются/передаются в `RecipeDetailModal.onEdit`), `handleEdit`, `toggleFavorite` (вызывается и из `RecipeCard`, и из `RecipeDetailModal`), один вызов `useRecipeFilters(recipes, programs)`, JSX-скелет (toolbar / sidebar / grid / модалки).

### 2. `useRecipeFilters.ts`
Вся фильтрация: `recipeView`, `searchQuery`, `filterSortBy`, `filterCategories`+`toggleFilterCategory`, `filterAuthors`/`filterPrograms` (raw setters — `toggleFilterAuthor`/`toggleFilterProgram` уже удалены как мёртвый код в шаге 0, не переносить), `filterMaxTime`, `filterMaxCalories`, derived `allAuthors`/`allPrograms`/`filteredRecipes`/`hasActiveFilters`, `resetFilters()`.

**Важно (поведенческая деталь):** два существующих "сбросить" по-разному сбрасывают состояние — toolbar-дропдаун сбрасывает только 5 фильтров, блок "ничего не найдено" сбрасывает те же 5 полей **плюс** `searchQuery`. `resetFilters()` в хуке покрывает только 5 фильтров; вызов из блока "не найдено" дополнительно зовёт `setSearchQuery('')` — сохраняем текущее поведение 1:1.

**Критично:** хук вызывается **ровно один раз**, в `RecipesView.tsx`. Если `RecipesToolbar`/`RecipeFilterSidebar` вызовут его каждый у себя — получим два независимых состояния, которые расходятся молча (класс выбран в сайдбаре не отразится в тулбаре). Явно проверяется на шаге 4.

### 3. `RecipesToolbar.tsx`
Локальный `AddRecipeOption` (перенос как есть) + локальные `isFilterOpen`/`isAddRecipeDropdownOpen`. Рендерит sticky-тулбар (поиск, All/Favorites, фильтр-дропдаун, add-recipe-дропдаун). Фильтр-состояние приходит пропами из единственного вызова хука в `RecipesView`.

### 4. `RecipeFilterSidebar.tsx`
Локальный `SidebarItem`. Десктопный постоянный сайдбар — те же фильтр-пропы.

### 5. `RecipesEmptyState.tsx` ✅ извлечён (commit `9253de4`)
Локальный `ActionButton` + JSX текущего `renderEmptyState()`. Пропы: `photoInputRef`, `onAddPDF`, `onAddLink`, `onAddManual`.

### 6. `RecipeCard.tsx` ✅ извлечён (commit `b6e3ee9`)
Карточка грида (drag-start, чекбокс selection-mode, allergen-бейдж, favorite). Импортирует `recipeAllergens`/`recipeHasAllergens` из `@/shared/domain/allergies` напрямую (safety-critical constraint №1). Allergen-`alert()` на клике по карточке живёт внутри `RecipeCard`, перед вызовом `onSelectRecipe`.

### 7. `AddRecipeModals.tsx` (самый большой по строкам, но почти всё состояние локально)
Переносятся целиком: `cropImage`, `addRecipeToTarget`, `analyzePhoto`, `handleAddManual`, `handleLinkSubmit`, `handleAddProductToRecipe`, и два инлайн-обработчика, вынесенные в именованные функции при переносе (чисто механическое переименование, поведение не меняется): `handlePdfFileSelected` (текущий ~64-строчный `onChange` PDF-инпута), `handleDeleteConfirmed`. Рендерит: Delete Confirm, Product Add, PDF Add, Link Add, Manual Add/Edit модалки, скрытый cross-tab photo `<input>`, full-screen scanning overlay. `recipesRepo`/`programsRepo` — через собственный `useRepositories()` (как в `ProgramDetailModal.tsx`), не пропсами.

Экспортирует типы `RecipeFormData`, `ProductFormData` (переиспользуются в `RecipesView.tsx`).

**ROADMAP.md** ссылается на `RecipesView.handleLinkSubmit` (открытый баг «импорт по ссылке не работает», раздел «Баги») — при переносе функции в этот файл обновить ссылку на `AddRecipeModals.handleLinkSubmit` в этом же коммите. Имя функции не менять — так grep/трассировка не ломается.

### 8. `RecipeDetailModal.tsx` (536 строк, самое рискованное извлечение — делается последним)
Локально: `isUpdatingImage`, `isRecalculatingKbzhu`, `showSaveSuccess`, `isCollectionPickerOpen`, `portionCount`+его `useEffect`, `isPlanning`, `planDetails`, `handleShareRecipe`, `handleAddToPlanner` (safety-critical constraint №1 — прямой перенос вызова `recipeAllergens`/`recipeHasAllergens`, не переписывать).

Пропы: `recipe: Recipe` (= `selectedRecipe`, ненулевой — `RecipesView` монтирует этот компонент только когда `selectedRecipe` истинный), `programs`, `userProfile`, `onSelectedRecipeChange`, `onToggleFavorite`, `onEdit`, `onDeleteRequested`.

**scaleMacros**: IIFE со скалированием КБЖУ по количеству порций (внутри блока с портционным степпером в детальной модалке) выносится в `src/shared/domain/macros.ts` как экспортируемая чистая функция рядом с `sumMacros`/`remainingMacros`:
```ts
export function scaleMacros(macros: Macros, portionCount: number, baseServings: number): Macros {
  const base = Math.max(1, baseServings);
  return {
    calories: Math.round((macros.calories * portionCount) / base),
    proteins: Math.round((macros.proteins * portionCount) / base),
    fats: Math.round((macros.fats * portionCount) / base),
    carbs: Math.round((macros.carbs * portionCount) / base),
  };
}
```
Единственное место, где стоит добавить unit-тест в рамках этого рефакторинга — `src/shared/domain/__tests__/macros.test.ts` уже существует и тестирует соседние функции того же модуля; несколько кейсов на `scaleMacros` (portionCount=1 identity, ×2, servings=0 → клампится к 1) — минимальная, оправданная страховка для единственной арифметики, которая не просто переезжает, а переименовывается. Компонентные тесты на новые view-файлы не добавляются (нет прецедента даже для `ProgramDetailModal.tsx`).

Кнопку «Пересчитать КБЖУ» через `scaleMacros` не пропускать — другая форма данных (AI-тотал → per-serving, а не per-serving → к portionCount), унификация вне скоупа.

## Попутные zero-risk чистки (шаг 0) ✅ выполнено (commit `33e8cd5`)
- Мёртвые импорты иконок `Upload`, `Settings`, `ChevronDown` — убраны.
- Мёртвый проп `selectionTarget` в `RecipesViewProps` — убран (+ передача из `App.tsx`).
- Мёртвые `toggleFilterAuthor`/`toggleFilterProgram` — удалены.

## Дублирование фильтров в тулбаре и сайдбаре — осознанное решение
`useRecipeFilters` естественным образом устраняет дублирование *логики* (один хук, один источник состояния для обоих UI-блоков). Дублирование *разметки* (чипсы категорий, селекты авторов/программ, слайдеры — во floating-дропдауне и в постоянном сайдбаре, с разной вёрсткой) **не трогаем** — это визуально-поведенческое решение, а не структурный перенос, риск регресса без тестов не оправдан рамками этой находки. Если понадобится — отдельная будущая находка.

## Порядок извлечения (от минимального риска к максимальному)

Каждый шаг — отдельный коммит, независимо проверяемый (typecheck + eslint + build + смоук-тест) перед переходом к следующему.

- [x] **Шаг 0** — dead-code чистка. Commit `33e8cd5`.
- [x] **Шаг 1** — `RecipesEmptyState.tsx`. Commit `9253de4`.
- [x] **Шаг 2** — `RecipeCard.tsx`. Commit `b6e3ee9`.
- [x] **Шаг 3** — `useRecipeFilters.ts` (только логика, JSX тулбара/сайдбара пока остаётся в `RecipesView.tsx` инлайн — так «сломал ли я логику фильтрации» проверяется отдельно от «сломал ли я вынос разметки»). Смоук: поиск, view-toggle, сортировка, категории/авторы/программы, слайдеры времени/калорий, оба reset-кнопки (проверить, что «не найдено»-ресет действительно чистит и поиск тоже), счётчик «Найдено: N». Commit `98aa3df`.
- [x] **Шаг 4** — `RecipesToolbar.tsx` + `RecipeFilterSidebar.tsx`, оба потребляют вывод хука пропами из единственного вызова в `RecipesView.tsx`. Это шаг, на котором легче всего случайно завести вторую независимую копию хука — явно проверить при ревью. Смоук: чек-лист шага 3 + синхронизация тулбар↔сайдбар (выбрать категорию в сайдбаре → открыть дропдаун тулбара → та же категория отмечена). Commit `81f37a0`.
- [x] **Шаг 5** — `AddRecipeModals.tsx`. Самый большой перенос. Делается до детальной модалки, потому что `handleEdit` (остаётся в `RecipesView.tsx`) зависит от пропов этого шага (`onFormDataChange`, `onEditingIdChange`, `onIsAddingManualChange`), которые должны быть уже стабильны к моменту подключения `RecipeDetailModal.onEdit` на шаге 6. Смоук (самый плотный): ручное добавление (включая «Рассчитать КБЖУ ИИ», «Добавить продукт с КБЖУ», фото + «Распознать текст ИИ»), добавление по ссылке, по PDF (мульти-рецепт если есть), по фото (cross-tab скрытый инпут), delete-confirm, `recipeTarget` cross-tab добавление для всех 4 путей импорта. Отдельно перепроверить текущий баг импорта по ссылке (симптом должен остаться тем же, не новым) и обновить `ROADMAP.md` (раздел «Баги») в этом же коммите. Commit `cae16d1`.
- [x] **Шаг 6** — `RecipeDetailModal.tsx` (максимальный риск, делается последним, когда `RecipesView.tsx` уже облегчён и пропы стабильны). Смоук: открытие с грида и через `?recipeId=` deep-link, edit (round-trip в форму и обратно), favorite-синхронизация карточка↔модалка, share (буфер обмена), delete, замена фото + toast, «Пересчитать КБЖУ» (loading + error path), степпер порций + `scaleMacros`, коллекции (добавить/убрать из программы), планирование (дата/приём, allergy-confirm gate — safety-critical, `alert()` на успех), «Готово». Commit `6ffe15f`.
- [x] **Шаг 7** — финальный проход: не осталось ли в облегчённом `RecipesView.tsx` того, что должно было переехать; нет ли мёртвых импортов в новых файлах; каждый новый файл определяет свой локальный `cn()` (как `ProgramDetailModal.tsx`), а не тянет общий util — не вводить новую shared-абстракцию как побочный эффект. Плюс итоговая проверка (ниже) и отметка CONV-1 `✅ Исправлено` в `docs/audits/2026-07-19-project-audit-report.md`. Commit `4f38e75`.

## Итоговая проверка (после шага 7)
1. `npm run lint` (tsc --noEmit) — чисто по всем новым/изменённым файлам.
2. `npm run lint:eslint` — чисто (без учёта уже известного долга на нетронутых этим рефакторингом файлах).
3. `npm run test` — полный сюит проходит (включая новые кейсы `scaleMacros` в `macros.test.ts`).
4. `npm run build` — прод-сборка проходит (ловит забытые unresolved imports после разбиения).
5. Полный ручной смоук-чеклист Recipes-вкладки ещё раз целиком (все пункты шагов 1–6 разом).
6. `ROADMAP.md` (раздел «Баги») — ссылка обновлена на `AddRecipeModals.handleLinkSubmit`.
7. `Technical_Project_Documentation.md` → раздел «Структура файлов» — добавить новые файлы под `src/features/recipes/` (правило CLAUDE.md «Technical documentation update rule»).

## Ключевые файлы
- `src/features/recipes/RecipesView.tsx` — источник декомпозиции (2617 → 2409 строк на конец шага 2)
- `src/App.tsx` — вызывающая сторона
- `src/features/programs/ProgramDetailModal.tsx` — прецедент паттерна (контролируемые пропы, локальный `cn()`, `useRepositories()`)
- `src/shared/domain/macros.ts` + `src/shared/domain/__tests__/macros.test.ts` — куда переезжает `scaleMacros`
- `src/shared/domain/allergies.ts` — safety-critical импорт, не реализовывать заново
- `ROADMAP.md` (раздел «Баги») — ссылка на `handleLinkSubmit`
