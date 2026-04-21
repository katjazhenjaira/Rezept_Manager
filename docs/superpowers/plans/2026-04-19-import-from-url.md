# import-from-url Worker Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `import-from-url` Gemini call from `App.tsx` to the Cloudflare Worker AI proxy, so the API key never reaches the browser.

**Architecture:** Extract the Gemini image-generation logic into a shared helper `generateImageDataUri` (used by both the existing `generateImage` route and the new `importFromUrl` route). The `importFromUrl` route calls Gemini with `urlContext` tool, then falls back to `generateImageDataUri` if no image URL was returned. The client replaces its direct `GoogleGenAI` call with `aiClient.importFromUrl()`.

**Tech Stack:** Hono, `@google/genai` (`GoogleGenAI`, `Type`), TypeScript strict, Vite dev proxy (`/api → :8787`), `wrangler dev`.

---

## File map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/services/ai/contracts.ts` | Fix `ImportedRecipe.ingredients` and `.steps` to `string[]` |
| Create | `worker/src/helpers/generateImageDataUri.ts` | Pure Gemini image helper (no Hono context) |
| Modify | `worker/src/routes/generateImage.ts` | Use the extracted helper |
| Create | `worker/src/routes/importFromUrl.ts` | New route handler |
| Modify | `worker/src/index.ts` | Replace 501 stub with real route |
| Modify | `src/App.tsx` | Replace direct Gemini call with `aiClient.importFromUrl()` |

---

### Task 1: Fix `ImportedRecipe` contract types

**Files:**
- Modify: `src/services/ai/contracts.ts`

- [ ] **Step 1: Update `ingredients` and `steps` from `string` to `string[]`**

In `src/services/ai/contracts.ts`, find `ImportedRecipe` and change:

```ts
export type ImportedRecipe = {
  title: string;
  author?: string;
  ingredients: string[];   // was: string
  steps: string[];         // was: string
  time: string;
  categories: string[];
  servings: number;
  macros: Macros;
  dishImage?: string;
  pageNumber?: number;
  dishBoundingBox?: { ymin: number; xmin: number; ymax: number; xmax: number };
};
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager
npm run build 2>&1 | head -40
```

Expected: build succeeds or errors are only in files not yet updated (App.tsx). If `import-from-pdf` or `import-from-photo` stubs break — note the error but don't fix now (they are still 501 stubs, no real usage).

- [ ] **Step 3: Commit**

```bash
git add src/services/ai/contracts.ts
git commit -m "fix(contracts): ImportedRecipe ingredients and steps as string[]"
```

---

### Task 2: Extract `generateImageDataUri` helper

**Files:**
- Create: `worker/src/helpers/generateImageDataUri.ts`
- Modify: `worker/src/routes/generateImage.ts`

- [ ] **Step 1: Create the helper file**

Create `worker/src/helpers/generateImageDataUri.ts`:

```ts
import { GoogleGenAI } from "@google/genai";

export async function generateImageDataUri(
  ai: GoogleGenAI,
  title: string,
  ingredients: string[]
): Promise<string | null> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        {
          text: `A professional food photography of ${title}. Ingredients: ${ingredients.join(", ")}. High quality, appetizing, top view or 45 degree angle.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "4:3",
        imageSize: "1K",
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}
```

- [ ] **Step 2: Refactor `generateImage.ts` to use the helper**

Replace the body of `worker/src/routes/generateImage.ts` with:

```ts
import type { Context } from "hono";
import { GoogleGenAI } from "@google/genai";
import type {
  GenerateImageRequest,
  GenerateImageResponse,
} from "../../../src/services/ai/contracts";
import { generateImageDataUri } from "../helpers/generateImageDataUri";

type Bindings = { GEMINI_API_KEY: string };

export async function generateImage(c: Context<{ Bindings: Bindings }>) {
  const body = await c.req.json<GenerateImageRequest>();
  const { title, ingredients } = body;

  if (!title || !Array.isArray(ingredients)) {
    return c.json({ error: "Expected { title: string, ingredients: string[] }" }, 400);
  }

  const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
  const dataUri = await generateImageDataUri(ai, title, ingredients);

  if (!dataUri) {
    return c.json({ error: "Gemini returned no inline image data" }, 502);
  }

  const payload: GenerateImageResponse = { imageDataUri: dataUri };
  return c.json(payload);
}
```

- [ ] **Step 3: Verify wrangler builds**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager/worker
npx wrangler deploy --dry-run --outdir dist 2>&1 | tail -20
```

Expected: build succeeds, `dist/` produced.

- [ ] **Step 4: Commit**

```bash
git add worker/src/helpers/generateImageDataUri.ts worker/src/routes/generateImage.ts
git commit -m "refactor(worker): extract generateImageDataUri helper"
```

---

### Task 3: Create `importFromUrl` route

**Files:**
- Create: `worker/src/routes/importFromUrl.ts`

- [ ] **Step 1: Create the route file**

Create `worker/src/routes/importFromUrl.ts`:

```ts
import type { Context } from "hono";
import { GoogleGenAI, Type } from "@google/genai";
import type {
  ImportFromUrlRequest,
  ImportFromUrlResponse,
  ImportedRecipe,
} from "../../../src/services/ai/contracts";
import { generateImageDataUri } from "../helpers/generateImageDataUri";

type Bindings = { GEMINI_API_KEY: string };

export async function importFromUrl(c: Context<{ Bindings: Bindings }>) {
  const body = await c.req.json<ImportFromUrlRequest>();
  const { url, availableCategories } = body;

  if (typeof url !== "string" || !url.trim()) {
    return c.json({ error: "Expected { url: string, availableCategories: string[] }" }, 400);
  }

  const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: `You are a precise recipe extraction engine. Your goal is to extract recipe data ONLY from the provided URL. For categories, ONLY choose from this list: ${availableCategories.join(", ")}. If the content is not a recipe or cannot be accessed, return an error or a very minimal object. NEVER hallucinate a recipe from a different source.`,
      tools: [{ urlContext: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          author: { type: Type.STRING, description: "Name of the author, channel name, or creator" },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          time: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          proteins: { type: Type.NUMBER },
          fats: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          categories: { type: Type.ARRAY, items: { type: Type.STRING } },
          servings: { type: Type.NUMBER },
          imageUrl: { type: Type.STRING, description: "Direct URL to the recipe image or video thumbnail" },
        },
        required: ["title", "ingredients", "steps", "time", "calories", "proteins", "fats", "carbs", "categories", "servings"],
      },
    },
    contents: `TASK: Extract the recipe details ONLY from the provided URL: ${url}.
CONTEXT: This link might be a website, an Instagram Reel, or a TikTok video.
INSTRUCTIONS:
1. Read the page content or video description carefully.
2. Extract the Title, Ingredients, Steps, Time, and Macros.
3. ВАЖНО: Если КБЖУ (калории, белки, жиры, углеводы) не указаны на странице явно, ПОЖАЛУЙСТА, РАССЧИТАЙТЕ ИХ самостоятельно на основе ингредиентов и их количества.
4. IMPORTANT: Find the primary image URL or video thumbnail URL. If it's a video, look for the 'og:image' or 'thumbnail' in the metadata.
5. Extract the author's name or channel name.
6. If the page contains multiple recipes, pick the main one.
7. DO NOT hallucinate or use external knowledge. Only use what's on the page.
8. Return the data in Russian.`,
  });

  const data = JSON.parse(response.text ?? "{}") as {
    title?: string;
    author?: string;
    ingredients?: string[];
    steps?: string[];
    time?: string;
    calories?: number;
    proteins?: number;
    fats?: number;
    carbs?: number;
    categories?: string[];
    servings?: number;
    imageUrl?: string;
  };

  let dishImage: string | undefined = data.imageUrl ?? undefined;
  if (!dishImage) {
    const generated = await generateImageDataUri(
      ai,
      data.title ?? "Новый рецепт",
      data.ingredients ?? []
    );
    if (generated) dishImage = generated;
  }

  const recipe: ImportedRecipe = {
    title: data.title ?? "Новый рецепт",
    author: data.author,
    ingredients: data.ingredients ?? [],
    steps: data.steps ?? [],
    time: data.time ?? "30 мин",
    servings: data.servings ?? 2,
    categories: (data.categories ?? []).filter((cat) =>
      availableCategories.map((c) => c.toLowerCase()).includes(cat.toLowerCase())
    ),
    macros: {
      calories: data.calories ?? 0,
      proteins: data.proteins ?? 0,
      fats: data.fats ?? 0,
      carbs: data.carbs ?? 0,
    },
    dishImage,
  };

  const payload: ImportFromUrlResponse = { recipe };
  return c.json(payload);
}
```

- [ ] **Step 2: Verify wrangler builds**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager/worker
npx wrangler deploy --dry-run --outdir dist 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/importFromUrl.ts
git commit -m "feat(worker): add import-from-url route"
```

---

### Task 4: Register route in worker index

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Replace the 501 stub**

In `worker/src/index.ts`, add the import and replace the stub line:

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { generateImage } from "./routes/generateImage";
import { calculateKbzhu } from "./routes/calculateKbzhu";
import { importFromUrl } from "./routes/importFromUrl";

type Bindings = {
  GEMINI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

app.get("/", (c) => c.text("Rezept Manager AI proxy"));

app.onError((err, c) => {
  console.error("AI proxy error:", err);
  return c.json({ error: err.message || "Internal error" }, 500);
});

app.post("/api/ai/generate-image", generateImage);
app.post("/api/ai/calculate-kbzhu", calculateKbzhu);
app.post("/api/ai/import-from-url", importFromUrl);

// Остальные 3 ещё не портированы — stubs.
const NOT_IMPLEMENTED = { error: "Not implemented yet (Phase 0b)" };
app.post("/api/ai/import-from-pdf", (c) => c.json(NOT_IMPLEMENTED, 501));
app.post("/api/ai/import-from-photo", (c) => c.json(NOT_IMPLEMENTED, 501));
app.post("/api/ai/fill-remaining", (c) => c.json(NOT_IMPLEMENTED, 501));

export default app;
```

- [ ] **Step 2: Verify wrangler builds**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager/worker
npx wrangler deploy --dry-run --outdir dist 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Smoke-test with wrangler dev + curl**

In one terminal:
```bash
cd /Users/evidenee/Flowgence/Rezept_Manager/worker
npx wrangler dev --local
```

In another terminal (replace URL with any real recipe page):
```bash
curl -s -X POST http://localhost:8787/api/ai/import-from-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://eda.ru/recepty/salaty/olivye-22005","availableCategories":["salads","soups","main","desserts","breakfast","snacks","drinks","other"]}' \
  | python3 -m json.tool | head -40
```

Expected: JSON with `recipe.title`, `recipe.ingredients` (array), `recipe.macros`.

- [ ] **Step 4: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): register import-from-url route"
```

---

### Task 5: Update App.tsx to use aiClient

**Files:**
- Modify: `src/App.tsx` (lines ~1053–1141)

- [ ] **Step 1: Replace `handleLinkSubmit` body**

Find the function `handleLinkSubmit` in `src/App.tsx`. Replace the entire `try` block (lines ~1057–1138) with:

```ts
const handleLinkSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!recipeLink.trim()) return;

  setIsScanning(true);
  try {
    const result = await aiClient.importFromUrl({
      url: recipeLink,
      availableCategories,
    });
    const r = result.recipe;

    const recipeData = {
      title: r.title,
      author: r.author ?? "",
      image: r.dishImage ?? null,
      sourceUrl: recipeLink,
      time: r.time,
      servings: r.servings,
      categories: r.categories,
      ingredients: r.ingredients,
      steps: r.steps,
      macros: r.macros,
      isFavorite: false,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, "recipes"), recipeData);
    if (recipeTarget) {
      await addRecipeToTarget(docRef.id);
    }

    setIsAddingLink(false);
    setRecipeLink('');
    alert("Рецепт успешно добавлен!");
  } catch (error) {
    console.error("Error scanning link:", error);
    alert("Не удалось распознать рецепт по ссылке. Попробуйте другую ссылку или добавьте вручную.");
  } finally {
    setIsScanning(false);
  }
};
```

- [ ] **Step 2: Add `aiClient` import at the top of App.tsx (if not already present)**

Check if `aiClient` is already imported:
```bash
grep -n "aiClient" /Users/evidenee/Flowgence/Rezept_Manager/src/App.tsx | head -5
```

If not found, add after the existing imports:
```ts
import { aiClient } from './services/ai/aiClient';
```

- [ ] **Step 3: Check if `GoogleGenAI` / `Type` import can be removed**

```bash
grep -n "GoogleGenAI\|from \"@google/genai\"" /Users/evidenee/Flowgence/Rezept_Manager/src/App.tsx
```

If the only remaining references are in `import-from-photo` and `fill-remaining` handlers (lines ~933, ~396, ~5674), keep the import for now. Remove it only when all 6 routes are ported.

- [ ] **Step 4: Build and check for TS errors**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager
npm run build 2>&1 | head -40
```

Expected: 0 errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 5: Browser smoke-test**

Start dev servers:
```bash
# Terminal 1 — worker
cd worker && npx wrangler dev --local

# Terminal 2 — Vite
cd /Users/evidenee/Flowgence/Rezept_Manager && npm run dev
```

Open the app → add recipe → paste a real recipe URL → click scan. Verify:
- Recipe title, ingredients (list), steps (list) appear correctly
- КБЖУ populated
- Image present (either from page or generated)
- Recipe saved to Firestore (check Firebase console)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): use aiClient.importFromUrl, remove direct Gemini call"
```
