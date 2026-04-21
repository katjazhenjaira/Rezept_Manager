# import-from-pdf Worker Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `import-from-pdf` Gemini call from `App.tsx` to the Cloudflare Worker AI proxy, keeping browser-only operations (Canvas image extraction) on the client.

**Architecture:** Worker receives `{ pdfBase64, availableCategories }`, calls Gemini with the PDF as inline data, returns `{ recipes: ImportedRecipe[] }` with `ingredients: string[]` and `steps: string[]` (no `dishImage` — image extraction requires Canvas API unavailable in Workers). Client extracts images from PDF pages using `pdfjs-dist` + Canvas, falls back to `aiClient.generateImage()` if extraction fails.

**Tech Stack:** Hono, `@google/genai` (`GoogleGenAI`, `Type`), `pdfjs-dist` (client only), TypeScript strict.

---

## File map

| Action | File | Purpose |
|--------|------|---------|
| Create | `worker/src/routes/importFromPdf.ts` | New route handler |
| Modify | `worker/src/index.ts` | Replace 501 stub |
| Modify | `src/App.tsx` (~lines 5618–5739) | Replace direct Gemini call with aiClient |

No changes to `src/services/ai/contracts.ts` — `ImportedRecipe` already has `ingredients: string[]`, `steps: string[]`, `dishImage?: string`, `pageNumber?: number`, `dishBoundingBox?`.

---

### Task 1: Create `importFromPdf` route

**Files:**
- Create: `worker/src/routes/importFromPdf.ts`

- [ ] **Step 1: Create the route file**

Create `worker/src/routes/importFromPdf.ts`:

```ts
import type { Context } from "hono";
import { GoogleGenAI, Type } from "@google/genai";
import type {
  ImportFromPdfRequest,
  ImportFromPdfResponse,
  ImportedRecipe,
} from "../../../src/services/ai/contracts";

type Bindings = { GEMINI_API_KEY: string };

export async function importFromPdf(c: Context<{ Bindings: Bindings }>) {
  const body = await c.req.json<ImportFromPdfRequest>();
  const { pdfBase64, availableCategories } = body;

  if (typeof pdfBase64 !== "string" || !pdfBase64.trim()) {
    return c.json({ error: "Expected { pdfBase64: string, availableCategories: string[] }" }, 400);
  }
  if (!Array.isArray(availableCategories)) {
    return c.json({ error: "Expected { pdfBase64: string, availableCategories: string[] }" }, 400);
  }

  const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });

  let data: { recipes?: Array<{
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
    pageNumber?: number;
    dishBoundingBox?: { ymin: number; xmin: number; ymax: number; xmax: number };
  }> };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBase64,
          },
        },
        {
          text: `Extract ALL recipe details from this PDF. If there are multiple recipes, return them all. Return structured data in Russian.
Include title, ingredients as an array of strings, steps as an array of strings, time, calories, proteins, fats, carbs, servings.
ВАЖНО: Если КБЖУ (калории, белки, жиры, углеводы) не указаны в документе явно, ПОЖАЛУЙСТА, РАССЧИТАЙТЕ ИХ самостоятельно на основе ингредиентов и их количества.
Include 'author' if mentioned in the document.
For each recipe, provide the 'pageNumber' (1-indexed) and 'dishBoundingBox' with ymin, xmin, ymax, xmax for the main photo associated with that recipe. Use normalized coordinates (0-1000).
For categories, ONLY choose from this list: ${availableCategories.join(", ")}.`,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recipes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  author: { type: Type.STRING },
                  ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                  steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  time: { type: Type.STRING },
                  calories: { type: Type.NUMBER },
                  proteins: { type: Type.NUMBER },
                  fats: { type: Type.NUMBER },
                  carbs: { type: Type.NUMBER },
                  categories: { type: Type.ARRAY, items: { type: Type.STRING } },
                  servings: { type: Type.NUMBER },
                  pageNumber: { type: Type.NUMBER },
                  dishBoundingBox: {
                    type: Type.OBJECT,
                    properties: {
                      ymin: { type: Type.NUMBER },
                      xmin: { type: Type.NUMBER },
                      ymax: { type: Type.NUMBER },
                      xmax: { type: Type.NUMBER },
                    },
                  },
                },
                required: ["title", "ingredients", "steps", "time", "calories", "proteins", "fats", "carbs", "categories", "servings"],
              },
            },
          },
          required: ["recipes"],
        },
      },
    });

    data = JSON.parse(response.text ?? '{"recipes":[]}') as typeof data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Gemini error: ${message}` }, 502);
  }

  const recipes: ImportedRecipe[] = (data.recipes ?? []).map((r) => ({
    title: r.title ?? "Новый рецепт",
    author: r.author,
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? [],
    time: r.time ?? "30 мин",
    servings: r.servings ?? 2,
    categories: (r.categories ?? [])
      .map((cat) => availableCategories.find((ac) => ac.toLowerCase() === cat.toLowerCase()))
      .filter((cat): cat is string => cat !== undefined),
    macros: {
      calories: r.calories ?? 0,
      proteins: r.proteins ?? 0,
      fats: r.fats ?? 0,
      carbs: r.carbs ?? 0,
    },
    pageNumber: r.pageNumber,
    dishBoundingBox: r.dishBoundingBox,
  }));

  const payload: ImportFromPdfResponse = { recipes };
  return c.json(payload);
}
```

- [ ] **Step 2: Verify wrangler builds**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager/worker
npx wrangler deploy --dry-run --outdir dist 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/importFromPdf.ts
git commit -m "feat(worker): add import-from-pdf route"
```

---

### Task 2: Register route in worker index

**Files:**
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Add import and replace stub**

Replace the entire content of `worker/src/index.ts` with:

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { generateImage } from "./routes/generateImage";
import { calculateKbzhu } from "./routes/calculateKbzhu";
import { importFromUrl } from "./routes/importFromUrl";
import { importFromPdf } from "./routes/importFromPdf";

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
app.post("/api/ai/import-from-pdf", importFromPdf);

// Остальные 2 ещё не портированы — stubs.
const NOT_IMPLEMENTED = { error: "Not implemented yet (Phase 0b)" };
app.post("/api/ai/import-from-photo", (c) => c.json(NOT_IMPLEMENTED, 501));
app.post("/api/ai/fill-remaining", (c) => c.json(NOT_IMPLEMENTED, 501));

export default app;
```

- [ ] **Step 2: Verify wrangler builds**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager/worker
npx wrangler deploy --dry-run --outdir dist 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add worker/src/index.ts
git commit -m "feat(worker): register import-from-pdf route"
```

---

### Task 3: Update App.tsx PDF handler

**Files:**
- Modify: `src/App.tsx` (~lines 5618–5739)

The current `onChange` handler for the PDF file input (around line 5618) calls `new GoogleGenAI(...)` directly. Replace the `reader.onloadend` callback body with:

- [ ] **Step 1: Find the exact location**

```bash
grep -n "reader.onloadend\|analyzeFromPDF\|isAddingPDF\|GoogleGenAI" /Users/evidenee/Flowgence/Rezept_Manager/src/App.tsx | grep -A2 -B2 "5[0-9][0-9][0-9]:"
```

Locate the `reader.onloadend = async () => {` block that starts around line 5623 and ends around line 5737.

- [ ] **Step 2: Replace the `reader.onloadend` callback**

Replace from `reader.onloadend = async () => {` through the closing `};` (before `reader.readAsDataURL(file)`) with:

```ts
reader.onloadend = async () => {
  const base64 = (reader.result as string).split(',')[1] ?? '';
  try {
    const result = await aiClient.importFromPdf({
      pdfBase64: base64,
      availableCategories,
    });

    for (const r of result.recipes) {
      let dishImage: string | null = null;

      if (r.pageNumber && r.dishBoundingBox) {
        const extracted = await extractImageFromPDF(base64, r.pageNumber, r.dishBoundingBox);
        if (extracted) dishImage = extracted;
      }

      if (!dishImage) {
        const generated = await aiClient.generateImage({
          title: r.title,
          ingredients: r.ingredients,
        });
        if (generated?.imageDataUri) dishImage = generated.imageDataUri;
      }

      await addDoc(collection(db, "recipes"), {
        title: r.title,
        author: r.author ?? "",
        image: dishImage,
        time: r.time,
        servings: r.servings,
        categories: r.categories,
        ingredients: r.ingredients,
        steps: r.steps,
        macros: r.macros,
        isFavorite: false,
        createdAt: new Date().toISOString(),
      });

      if (recipeTarget) {
        const docRef = await addDoc(collection(db, "recipes"), {});
        await addRecipeToTarget(docRef.id);
      }
    }

    setIsAddingPDF(false);
    alert(`Успешно добавлено рецептов: ${result.recipes.length}`);
  } catch (error) {
    console.error("Error analyzing PDF:", error);
    alert("Не удалось распознать PDF. Попробуйте другой файл.");
  } finally {
    setIsScanning(false);
  }
};
```

**IMPORTANT:** The `addDoc` loop above has a bug — it saves twice per recipe. The correct implementation uses a single `addDoc` call and captures the ref for `addRecipeToTarget`. Use this corrected version instead:

```ts
reader.onloadend = async () => {
  const base64 = (reader.result as string).split(',')[1] ?? '';
  try {
    const result = await aiClient.importFromPdf({
      pdfBase64: base64,
      availableCategories,
    });

    for (const r of result.recipes) {
      let dishImage: string | null = null;

      if (r.pageNumber && r.dishBoundingBox) {
        const extracted = await extractImageFromPDF(base64, r.pageNumber, r.dishBoundingBox);
        if (extracted) dishImage = extracted;
      }

      if (!dishImage) {
        const generated = await aiClient.generateImage({
          title: r.title,
          ingredients: r.ingredients,
        });
        if (generated?.imageDataUri) dishImage = generated.imageDataUri;
      }

      const docRef = await addDoc(collection(db, "recipes"), {
        title: r.title,
        author: r.author ?? "",
        image: dishImage,
        time: r.time,
        servings: r.servings,
        categories: r.categories,
        ingredients: r.ingredients,
        steps: r.steps,
        macros: r.macros,
        isFavorite: false,
        createdAt: new Date().toISOString(),
      });

      if (recipeTarget) {
        await addRecipeToTarget(docRef.id);
      }
    }

    setIsAddingPDF(false);
    alert(`Успешно добавлено рецептов: ${result.recipes.length}`);
  } catch (error) {
    console.error("Error analyzing PDF:", error);
    alert("Не удалось распознать PDF. Попробуйте другой файл.");
  } finally {
    setIsScanning(false);
  }
};
```

- [ ] **Step 3: Verify TypeScript build**

```bash
cd /Users/evidenee/Flowgence/Rezept_Manager
npm run build 2>&1 | head -30
```

Expected: 0 new TypeScript errors.

- [ ] **Step 4: Check if `GoogleGenAI` import can be removed**

```bash
grep -n "new GoogleGenAI" /Users/evidenee/Flowgence/Rezept_Manager/src/App.tsx
```

Expected: still 2 remaining calls (fill-remaining ~line 396, photo import ~line 938). Keep the import.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): use aiClient.importFromPdf, remove direct Gemini call from PDF handler"
```

---

### Task 4: Push to remote

- [ ] **Step 1: Push**

```bash
git push origin main
```

Expected: all 3 new commits on remote.
