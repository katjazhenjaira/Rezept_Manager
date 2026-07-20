# Phase 1 — Разбор Монолита

**Статус:** завершено (2026-07-18) — App.tsx: 7500 → 277 строк

## Чеклист

### 1. Доменный слой (Phase 1a) ✅ завершена (2026-04-26)

- [x] `src/shared/domain/types.ts` — все типы из `App.tsx:163-275`
- [x] `src/shared/domain/macros.ts` — sumMacros, remainingMacros, resolveActiveTargets
- [x] `src/shared/domain/allergies.ts` — recipeAllergens, recipeHasAllergens
- [x] `src/features/cart/services/staples.ts` — BASIC_KEYWORDS, isStaple
- [x] Vitest + тесты 100% покрытия (32 теста, 3 файла)

### 2. Сервисный слой (Phase 1b) ✅ завершена (2026-04-27)

- [x] Заменить все 3 вхождения `BASIC_KEYWORDS` в `App.tsx` на `isStaple()`
- [x] Repository-интерфейсы: RecipesRepository, PlannerRepository, ProgramsRepository, CartRepository, UserProfileRepository, NutritionPlanRepository
- [x] Firestore-реализации в `src/infrastructure/firestore/`
- [x] `src/infrastructure/firestore/converters.ts` (Timestamp ↔ ISO)
- [x] Тесты на репозитории с fake реализациями (86 тестов, 0 ошибок TS)

### 3a. Providers и Shell ✅ завершена (2026-04-27)

- [x] `src/app/providers/RepositoryProvider.tsx`
- [x] `src/app/providers/DataProvider.tsx`
- [x] `src/app/providers/UserProfileProvider.tsx`
- [x] `src/app/layout/Shell.tsx`, `TabBar.tsx`
- [x] Перенос `activeNutritionPlan` из localStorage в Firestore `settings/plan` (позже переименовано в `nutritionPlans/{uid}` — актуальная коллекция закреплена в `firestore.rules`, путь `settings/*` сейчас deny-ится)
- [x] Обновить `main.tsx` — обернуть App провайдерами
- [x] Тесты провайдеров (11 тестов: 4 DataProvider + 7 UserProfileProvider)
- [x] Shell.tsx: добавлен `pb-20` для fixed TabBar
- [x] DataProvider unmount тест усилён (listenerCount === 0 для всех 4 репозиториев)

### 3b. i18n ✅ завершена (2026-04-28)

- [x] `npm install i18next react-i18next`
- [x] `src/app/providers/I18nProvider.tsx`
- [x] `src/locales/ru.json`, `de.json`, `en.json`
- [x] Переключатель языка в Settings (ru/de/en)
- [x] Все строки в Shell.tsx и TabBar.tsx через `t()` хук

### 4. По одной вкладке

- [x] Settings → `src/features/settings/SettingsModal.tsx` (2026-04-28)
- [x] Cart → `src/features/cart/CartView.tsx` (2026-04-28)
- [x] Recipes → `src/features/recipes/RecipesView.tsx` (2026-04-28)
- [x] Programs → `src/features/programs/ProgramsView.tsx` + `ProgramDetailModal.tsx` (2026-04-30)
- [x] Planner → `src/features/planner/PlannerView.tsx` (2026-07-18, App.tsx: 2482 → 1395 строк)
- [x] Tracker → `src/features/tracker/TrackerView.tsx` (2026-07-18, App.tsx: 1395 → 540 строк)

### 5. Финальная очистка ✅ завершена (2026-07-18, App.tsx 540 → 277 строк)

- [x] `extractImageFromPDF`/`extractTextFromPDF` → `src/shared/utils/pdfUtils.ts` (3 копии → 1)
- [x] Удалить 3 дублирующих `onSnapshot` (recipes/cart/userProfile)
- [x] `addProductsToCart` перенесена в `ProgramDetailModal`
- [x] `SettingsModal` переведён на `useUserProfile()` контекст
- [x] `AppHeader` + `RecipeSelectionBar` → `src/app/layout/`
- [x] `DEFAULT_PROFILE` → `src/shared/domain/defaults.ts`
- [x] `firebase/firestore` убран из всех feature/shared/app файлов
- [ ] **TODO (future):** `AppHeader` хранит `currentLanguage` локально, не вызывает `changeLanguage()` — язык меняется только визуально. Подключить i18n или убрать переключатель из хедера.

## Критерий готовности (DoD) — выполнен

- `wc -l src/App.tsx` = 277 (< 300 ✅)
- `grep -r "firebase/firestore" src/features src/shared src/app` → 0 ✅
- `grep -r "BASIC_KEYWORDS" src/` → 1 match ✅
- 101 тест, 0 TS-ошибок ✅

## Ключевые решения

- `selectedRecipe`, `isAddingManual/Link/PDF` подняты в App.tsx как controlled props
- `openProgramId` как controlled prop в App.tsx
- `activeNutritionPlan` в Firestore `settings/plan` (не `settings/profile`)
- `useEffect` в SettingsModal гейтирован по `isOpen` — предотвращает затирание правок при Firestore snapshot
- `mealTypes` остался в App.tsx (Tracker тоже использует)
- Specs: `docs/superpowers/specs/2026-04-28-programs-extraction-design.md`, `2026-04-30-planner-extraction-design.md`, `2026-07-18-tracker-extraction-design.md`
- Plans: `docs/superpowers/plans/2026-04-28-programs-extraction.md`, `2026-07-18-planner-extraction.md`, `2026-07-18-tracker-extraction.md`, `2026-07-18-app-cleanup.md`
