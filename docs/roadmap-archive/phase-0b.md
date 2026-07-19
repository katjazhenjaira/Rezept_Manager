# Phase 0b — Gemini Proxy на Cloudflare Worker

**Статус:** завершено (2026-04-21)

## Чеклист

- [x] Подтянуть документацию через context7: Wrangler, `@google/genai`, Hono
- [x] Скаффолдинг `worker/` с `wrangler.toml`
- [x] 6 routes: `generate-image` ✅, `calculate-kbzhu` ✅, `import-from-url` ✅, `import-from-pdf` ✅, `import-from-photo` ✅, `fill-remaining` ✅
- [x] Shared contracts: `src/services/ai/contracts.ts`
- [x] Клиент: `src/services/ai/aiClient.ts`
- [x] Rate limiting (token bucket в Cloudflare KV, 10 req/min)
- [x] Переписать 6 вызовов `new GoogleGenAI()` в `App.tsx` на `aiClient.*` — все 6 удалены
- [x] Vite dev: `wrangler dev` на :8787, Vite proxy `/api → :8787`
- [x] Убрать `define: { 'process.env.GEMINI_API_KEY' }` из `vite.config.ts`
- [x] Cloudflare secret `GEMINI_API_KEY` в Worker
- [x] `aiClient.ts`: `API_BASE` использует `VITE_AI_WORKER_URL` для продакшена
- [x] Деплой Worker на Cloudflare
- [x] Деплой Pages на Cloudflare + кастомный домен `rezept-manager.flowgence.de`
- [x] Унифицировать image generation: удалён wrapper `generateRecipeImage`, везде `aiClient.generateImage()`
- [x] Ужесточить prompt `import-from-pdf`: "MUST include 'pageNumber' and 'dishBoundingBox' for every recipe"
- [ ] **TODO (known issue):** Firestore отклоняет рецепты с base64-картинкой > 1 МБ. Фикс: хранить в Cloudflare R2/Firebase Storage, в Firestore только URL. Планируется в Phase 1/хот-фикс.
- [ ] **TODO (Phase 1):** Устранить двойной fetch в `import-from-url` — добавить `rawOgImage` в response schema.
- [ ] **TODO (Phase 1):** Unit-тесты для `worker/src/middleware/rateLimit.ts` через `@cloudflare/vitest-pool-workers`.

## Критерий готовности (DoD)

- `grep -r GEMINI_API_KEY dist/` → 0 совпадений
- Все 6 AI-фич вручную работают через прокси
- Rate limit: 11-й запрос/мин возвращает 429

## Ключевые решения

- `ImportedRecipe.ingredients/steps` переведены с `string` на `string[]` — Gemini возвращает массивы
- `extractImageFromPDF` остаётся на клиенте (Canvas API недоступен в Workers)
- `generateImageDataUri` вынесен в `worker/src/helpers/generateImageDataUri.ts`
- `server.watch.ignored` в `vite.config.ts` для `.claude/`, `.playwright-mcp/`, `worker/` — без этого Claude Code ломал browser-тесты модалок
- Деплой (2026-04-21): `API_BASE` берёт `VITE_AI_WORKER_URL` из env, в dev fallback `""` (Vite proxy)
