# Phase 0a — Security Hygiene

**Статус:** завершено (2026-04-19)

## Чеклист

- [x] Firebase config → env (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_*`)
- [x] `src/firebase.ts` → `src/infrastructure/firebaseApp.ts`
- [x] `tsconfig.json`: alias `@/*` → `./src/*`, добавить `"strict": true`, `"noUncheckedIndexedAccess": true`
- [x] Починить ошибки, которые вскроет strict mode (23 фикса без TODO)
- [x] Удалить `better-sqlite3`, `dotenv` из `package.json`
- [x] Обновить `.env.example`

## Критерий готовности (DoD)

- `npm run build` — зелёный
- `npm run lint` (tsc --noEmit) — 0 ошибок
- `git grep -n 'AIza\|firebaseapp.com'` в `src/` — 0 совпадений

## Ключевые решения

- Firebase config вынесен в `VITE_FIREBASE_*` env; `src/firebase.ts` → `src/infrastructure/firebaseApp.ts`
- Включён TS strict + `noUncheckedIndexedAccess` — вскрыл 23 ошибки в App.tsx, все починены без TODO/any
- `getRecipeById` принимает `string | undefined`; guard-ы на `response.text` и `response.candidates?.[0]`
- Установлены `@types/react`/`@types/react-dom`; удалены неиспользуемые `better-sqlite3` и `dotenv`
- `.playwright-mcp/` добавлен в `.gitignore`
