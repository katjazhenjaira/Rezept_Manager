# Rate Limiting (KV Token Bucket) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect all 6 AI routes on the Cloudflare Worker from abuse with a sliding-window rate limit of 10 requests/minute per IP, returning 429 on excess.

**Architecture:** Cloudflare KV stores a per-IP request counter keyed by `rate:<ip>:<minute-bucket>` with a 60-second TTL. A Hono middleware checks and increments the counter before each request reaches a route handler. No auth yet, so IP from `CF-Connecting-IP` header is the identity signal.

**Tech Stack:** Hono middleware, Cloudflare KV (`KVNamespace`), `wrangler` CLI for namespace creation, TypeScript strict.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `worker/src/types.ts` | Shared `Env` bindings type (GEMINI_API_KEY + RATE_LIMIT_KV) |
| Create | `worker/src/middleware/rateLimit.ts` | Sliding-window rate limit logic |
| Modify | `worker/src/index.ts` | Use `Env` type, register `rateLimit` middleware on `/api/ai/*` |
| Modify | `worker/wrangler.toml` | Add `[[kv_namespaces]]` binding |

Individual route files (`routes/*.ts`) are **not modified** — they only consume `GEMINI_API_KEY` which remains available via the wider `Env` type.

---

## Task 1: Create Cloudflare KV namespace and update wrangler.toml

**Files:**
- Modify: `worker/wrangler.toml`

- [ ] **Step 1: Create KV namespace on Cloudflare**

Run from project root:
```bash
cd worker && npx wrangler kv namespace create RATE_LIMIT_KV
```

Expected output (IDs will differ):
```
🌀 Creating namespace with title "rezept-manager-worker-RATE_LIMIT_KV"
✅ Success!
Add the following to your configuration file in your kv_namespaces array:
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "abc123..."
```

Also create a preview namespace (used by `wrangler dev`):
```bash
npx wrangler kv namespace create RATE_LIMIT_KV --preview
```

Note both IDs.

- [ ] **Step 2: Update wrangler.toml**

Add after the `[observability]` block:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "<id from step 1>"
preview_id = "<preview_id from step 1>"
```

- [ ] **Step 3: Verify wrangler.toml parses correctly**

```bash
cd worker && npx wrangler deploy --dry-run 2>&1 | grep -E "RATE_LIMIT_KV|error|Error"
```

Expected: line mentioning `RATE_LIMIT_KV` binding, no errors.

- [ ] **Step 4: Commit**

```bash
git add worker/wrangler.toml
git commit -m "chore(worker): add RATE_LIMIT_KV namespace binding"
```

---

## Task 2: Create shared Env type

**Files:**
- Create: `worker/src/types.ts`

- [ ] **Step 1: Create the file**

```typescript
// worker/src/types.ts
export type Env = {
  GEMINI_API_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
};
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
cd worker && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/types.ts
git commit -m "chore(worker): add shared Env bindings type"
```

---

## Task 3: Implement the rate limit middleware

**Files:**
- Create: `worker/src/middleware/rateLimit.ts`

**Algorithm:** sliding window by minute bucket.
- Key: `rate:<ip>:<Math.floor(Date.now()/60000)>` — auto-expires at next minute
- KV TTL: 65 seconds (minute + small buffer so late reads within the same window still work)
- Read count → if >= 10 return 429 → write count+1

> Note: KV has no atomic increment, so two near-simultaneous requests could both read `9` and both proceed. This is acceptable for a best-effort rate limiter protecting against sustained abuse, not for strict accounting.

- [ ] **Step 1: Create the middleware file**

```typescript
// worker/src/middleware/rateLimit.ts
import type { Context, Next } from "hono";
import type { Env } from "../types";

const LIMIT = 10;
const TTL_SECONDS = 65;

export async function rateLimit(c: Context<{ Bindings: Env }>, next: Next) {
  const ip =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown";

  const minute = Math.floor(Date.now() / 60_000);
  const key = `rate:${ip}:${minute}`;

  const raw = await c.env.RATE_LIMIT_KV.get(key);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= LIMIT) {
    return c.json(
      { error: "Rate limit exceeded. Maximum 10 requests per minute." },
      429
    );
  }

  await c.env.RATE_LIMIT_KV.put(key, String(count + 1), {
    expirationTtl: TTL_SECONDS,
  });

  return next();
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd worker && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/middleware/rateLimit.ts
git commit -m "feat(worker): implement sliding-window rate limit middleware"
```

---

## Task 4: Wire middleware into index.ts

**Files:**
- Modify: `worker/src/index.ts`

Current `index.ts` uses `type Bindings = { GEMINI_API_KEY: string }`. We replace it with the shared `Env` type and register the middleware.

- [ ] **Step 1: Update index.ts**

Replace the full file contents with:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { generateImage } from "./routes/generateImage";
import { calculateKbzhu } from "./routes/calculateKbzhu";
import { importFromUrl } from "./routes/importFromUrl";
import { importFromPdf } from "./routes/importFromPdf";
import { importFromPhoto } from "./routes/importFromPhoto";
import { fillRemaining } from "./routes/fillRemaining";
import { rateLimit } from "./middleware/rateLimit";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());
app.use("/api/ai/*", rateLimit);

app.get("/", (c) => c.text("Rezept Manager AI proxy"));

app.onError((err, c) => {
  console.error("AI proxy error:", err);
  return c.json({ error: err.message || "Internal error" }, 500);
});

app.post("/api/ai/generate-image", generateImage);
app.post("/api/ai/calculate-kbzhu", calculateKbzhu);
app.post("/api/ai/import-from-url", importFromUrl);
app.post("/api/ai/import-from-pdf", importFromPdf);
app.post("/api/ai/import-from-photo", importFromPhoto);
app.post("/api/ai/fill-remaining", fillRemaining);

export default app;
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd worker && npx tsc --noEmit
```

Expected: 0 errors. If route files complain about Bindings mismatch, their local `type Bindings` is fine — Hono allows narrower bindings in route handlers than the app-level type.

- [ ] **Step 3: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): apply rate limit middleware to all AI routes"
```

---

## Task 5: Test locally

**Files:** none changed

- [ ] **Step 1: Start worker (kill old instance first)**

```bash
kill $(lsof -ti:8787) 2>/dev/null; cd worker && npx wrangler dev
```

Expected: `Ready on http://localhost:8787`

- [ ] **Step 2: Send 10 successful requests**

```bash
for i in $(seq 1 10); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8787/api/ai/calculate-kbzhu \
    -H "Content-Type: application/json" \
    -H "CF-Connecting-IP: 1.2.3.4" \
    -d '{"ingredients":"100g chicken"}')
  echo "Request $i: $STATUS"
done
```

Expected output:
```
Request 1: 200
Request 2: 200
...
Request 10: 200
```

- [ ] **Step 3: Verify 11th request returns 429**

```bash
curl -s -w "\nHTTP %{http_code}" -X POST http://localhost:8787/api/ai/calculate-kbzhu \
  -H "Content-Type: application/json" \
  -H "CF-Connecting-IP: 1.2.3.4" \
  -d '{"ingredients":"100g chicken"}'
```

Expected:
```json
{"error":"Rate limit exceeded. Maximum 10 requests per minute."}
HTTP 429
```

- [ ] **Step 4: Verify different IP is not rate-limited**

```bash
curl -s -w "\nHTTP %{http_code}" -X POST http://localhost:8787/api/ai/calculate-kbzhu \
  -H "Content-Type: application/json" \
  -H "CF-Connecting-IP: 9.9.9.9" \
  -d '{"ingredients":"100g chicken"}'
```

Expected: HTTP 200 (different IP has its own counter).

- [ ] **Step 5: Commit test results note in ROADMAP**

No code changes — proceed to deploy.

---

## Task 6: Deploy to production and update ROADMAP

**Files:**
- Modify: `worker/wrangler.toml` (already done in Task 1)
- Modify: `ROADMAP.md`

- [ ] **Step 1: Deploy Worker**

```bash
cd worker && npx wrangler deploy
```

Expected: `Deployed rezept-manager-worker` with the updated routes.

- [ ] **Step 2: Smoke-test production rate limit**

Send 11 requests to the production Worker URL (replace `<worker-url>` with your deployed URL):
```bash
for i in $(seq 1 11); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://<worker-url>/api/ai/calculate-kbzhu \
    -H "Content-Type: application/json" \
    -d '{"ingredients":"100g chicken"}')
  echo "Request $i: $STATUS"
done
```

Expected: first 10 return 200, 11th returns 429.

- [ ] **Step 3: Mark rate limiting done in ROADMAP.md**

In `ROADMAP.md`, change:
```
- [ ] Rate limiting (token bucket в Cloudflare KV, 10 req/min для import-операций)
```
to:
```
- [x] Rate limiting (token bucket в Cloudflare KV, 10 req/min для import-операций)
```

And update «Следующий шаг» to:
```
Следующий шаг: Запустить security-review skill → TODO code-review items.
```

- [ ] **Step 4: Final commit**

```bash
git add ROADMAP.md
git commit -m "feat(worker): rate limiting complete — KV sliding window 10 req/min"
```
