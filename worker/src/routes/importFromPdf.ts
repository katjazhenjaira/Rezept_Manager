import type { Context } from "hono";
import { GoogleGenAI, Type } from "@google/genai";
import type {
  ImportFromPdfRequest,
  ImportFromPdfResponse,
  ImportedRecipe,
} from "../../../src/services/ai/contracts";
import type { Env } from "../types";

export async function importFromPdf(c: Context<{ Bindings: Env }>) {
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
MUST include 'pageNumber' (1-indexed) and 'dishBoundingBox' with ymin, xmin, ymax, xmax for EVERY recipe — use the bounding box of the main dish photo on that page. Use normalized coordinates (0-1000). If no photo exists, estimate the box covering the top half of the page.
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
