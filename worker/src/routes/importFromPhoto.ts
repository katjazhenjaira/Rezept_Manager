import type { Context } from "hono";
import { GoogleGenAI, Type } from "@google/genai";
import type {
  ImportFromPhotoRequest,
  ImportFromPhotoResponse,
  ImportedRecipe,
} from "../../../src/services/ai/contracts";

type Bindings = { GEMINI_API_KEY: string };

export async function importFromPhoto(c: Context<{ Bindings: Bindings }>) {
  const body = await c.req.json<ImportFromPhotoRequest>();
  const { images, availableCategories } = body;

  if (!Array.isArray(images) || images.length === 0) {
    return c.json({ error: "Expected { images: Array<{ base64: string; mimeType: string }>, availableCategories: string[] }" }, 400);
  }
  if (!Array.isArray(availableCategories)) {
    return c.json({ error: "Expected { images: Array<{ base64: string; mimeType: string }>, availableCategories: string[] }" }, 400);
  }

  const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });

  const imageParts = images.map((img) => ({
    inlineData: {
      mimeType: img.mimeType,
      data: img.base64.includes(",") ? img.base64.split(",")[1]! : img.base64,
    },
  }));

  let data: {
    title?: string;
    ingredients?: string[];
    steps?: string[];
    time?: string;
    calories?: number;
    proteins?: number;
    fats?: number;
    carbs?: number;
    categories?: string[];
    servings?: number;
    sourceUrl?: string;
    dishBoundingBox?: { ymin: number; xmin: number; ymax: number; xmax: number };
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...imageParts,
        {
          text: `Extract recipe details from these images. Return structured data in Russian.
Include title, ingredients as an array of strings, steps as an array of strings, time, calories, proteins, fats, carbs, servings.
ВАЖНО: Если КБЖУ (калории, белки, жиры, углеводы) не указаны в источнике явно, ПОЖАЛУЙСТА, РАССЧИТАЙТЕ ИХ самостоятельно на основе ингредиентов и их количества.
For categories, ONLY choose from this list: ${availableCategories.join(", ")}.
If you find any URL or link to the original source in the text, include it in the 'sourceUrl' field.
MUST include 'dishBoundingBox' with ymin, xmin, ymax, xmax for the main dish shown in the images. Use normalized coordinates (0-1000).`,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
            steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            time: { type: Type.STRING },
            calories: { type: Type.NUMBER },
            proteins: { type: Type.NUMBER },
            fats: { type: Type.NUMBER },
            carbs: { type: Type.NUMBER },
            categories: { type: Type.ARRAY, items: { type: Type.STRING } },
            servings: { type: Type.NUMBER },
            sourceUrl: { type: Type.STRING, description: "URL to the original recipe source if found" },
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
    });

    data = JSON.parse(response.text ?? "{}") as typeof data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Gemini error: ${message}` }, 502);
  }

  const recipe: ImportedRecipe = {
    title: data.title ?? "Новый рецепт",
    sourceUrl: data.sourceUrl,
    ingredients: data.ingredients ?? [],
    steps: data.steps ?? [],
    time: data.time ?? "30 мин",
    servings: data.servings ?? 2,
    categories: (data.categories ?? [])
      .map((cat) => availableCategories.find((ac) => ac.toLowerCase() === cat.toLowerCase()))
      .filter((cat): cat is string => cat !== undefined),
    macros: {
      calories: data.calories ?? 0,
      proteins: data.proteins ?? 0,
      fats: data.fats ?? 0,
      carbs: data.carbs ?? 0,
    },
    dishBoundingBox: data.dishBoundingBox,
  };

  const payload: ImportFromPhotoResponse = { recipe };
  return c.json(payload);
}
