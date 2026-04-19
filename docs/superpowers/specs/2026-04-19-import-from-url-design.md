# Design: import-from-url worker route

**Date:** 2026-04-19  
**Phase:** 0b slice 3

## Goal

Port the `import-from-url` Gemini call from `App.tsx` to the Cloudflare Worker AI proxy, removing the last direct `GoogleGenAI` reference for this feature from the client.

## Contract changes

`src/services/ai/contracts.ts` — `ImportedRecipe.ingredients` and `steps` change from `string` to `string[]`. They were always arrays in practice (Gemini schema, Firestore model, allergy check code), the `string` type was a leftover stub.

## Worker route

**File:** `worker/src/routes/importFromUrl.ts`

- Accepts `ImportFromUrlRequest`: `{ url: string; availableCategories: string[] }`
- Calls Gemini with `tools: [{ urlContext: {} }]` and the same structured JSON schema / prompt currently in `App.tsx:1059–1098`
- If the response lacks `imageUrl`, calls the `generateImage` helper function directly (imported from `./generateImage`, not via HTTP) to produce a fallback
- Returns `{ recipe: ImportedRecipe }` matching `ImportFromUrlResponse`

## Worker index

`worker/src/index.ts` — replace the 501 stub for `/api/ai/import-from-url` with `importFromUrl`.

## Client changes

`App.tsx` — `handleLinkSubmit` (lines 1053–1141):
- Remove `new GoogleGenAI(...)` and the Gemini call block
- Replace with `const result = await aiClient.importFromUrl({ url: recipeLink, availableCategories })`
- Build `recipeData` from `result.recipe` (ingredients/steps are now arrays, imageUrl from `result.recipe.dishImage`)

## Error handling

Worker returns 400 for missing/invalid `url`. Gemini errors bubble to the existing `app.onError` handler (500). Client catch block stays as-is (shows alert).

## Out of scope

Rate limiting and removing `GEMINI_API_KEY` from `vite.config.ts` — tracked as separate checklist items in ROADMAP Phase 0b.
