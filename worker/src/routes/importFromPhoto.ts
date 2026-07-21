import type { Context } from 'hono';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  ImportFromPhotoRequest,
  ImportFromPhotoResponse,
  ImportedRecipe,
} from '../../../src/services/ai/contracts';
import type { Env } from '../types';
import { UPSTREAM_TIMEOUT_MS, isTimeoutError } from '../helpers/timeout';

// Matches the upload limit already advertised to the user in AddRecipeModals.tsx
// ("JPG, PNG до 5MB") — that hint isn't enforced anywhere client- or server-side today,
// so an oversized image currently goes straight to Gemini with no local guard (PERF-8).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function base64ByteLength(base64: string): number {
  const raw = base64.includes(',') ? base64.split(',')[1]! : base64;
  const padding = raw.match(/=+$/)?.[0].length ?? 0;
  return Math.floor((raw.length * 3) / 4) - padding;
}

export async function importFromPhoto(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<ImportFromPhotoRequest>();
  const { images, availableCategories } = body;

  if (!Array.isArray(images) || images.length === 0) {
    return c.json(
      {
        error:
          'Expected { images: Array<{ base64: string; mimeType: string }>, availableCategories: string[] }',
      },
      400,
    );
  }
  if (!Array.isArray(availableCategories)) {
    return c.json(
      {
        error:
          'Expected { images: Array<{ base64: string; mimeType: string }>, availableCategories: string[] }',
      },
      400,
    );
  }
  if (images.some((img) => base64ByteLength(img.base64) > MAX_IMAGE_BYTES)) {
    return c.json({ error: 'Image too large (max 5MB per image)' }, 400);
  }

  const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });

  const imageParts = images.map((img) => ({
    inlineData: {
      mimeType: img.mimeType,
      data: img.base64.includes(',') ? img.base64.split(',')[1]! : img.base64,
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
      model: 'gemini-3-flash-preview',
      contents: [
        ...imageParts,
        {
          text: `Extract recipe details from these images. Return structured data in Russian.
Include title, ingredients as an array of strings, steps as an array of strings, time, calories, proteins, fats, carbs, servings.
ВАЖНО: Если КБЖУ (калории, белки, жиры, углеводы) не указаны в источнике явно, ПОЖАЛУЙСТА, РАССЧИТАЙТЕ ИХ самостоятельно на основе ингредиентов и их количества.
For categories, ONLY choose from this list: ${availableCategories.join(', ')}.
If you find any URL or link to the original source in the text, include it in the 'sourceUrl' field.
MUST include 'dishBoundingBox' with ymin, xmin, ymax, xmax for the main dish shown in the images. Use normalized coordinates (0-1000).`,
        },
      ],
      config: {
        responseMimeType: 'application/json',
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
            sourceUrl: {
              type: Type.STRING,
              description: 'URL to the original recipe source if found',
            },
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
          required: [
            'title',
            'ingredients',
            'steps',
            'time',
            'calories',
            'proteins',
            'fats',
            'carbs',
            'categories',
            'servings',
          ],
        },
        abortSignal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    });

    data = JSON.parse(response.text ?? '{}') as typeof data;
  } catch (err) {
    console.error('[importFromPhoto] error:', err);
    if (isTimeoutError(err)) return c.json({ error: 'Upstream request timed out' }, 504);
    return c.json({ error: 'Failed to import recipe from photo' }, 502);
  }

  const recipe: ImportedRecipe = {
    title: data.title ?? 'Новый рецепт',
    sourceUrl: data.sourceUrl,
    ingredients: data.ingredients ?? [],
    steps: data.steps ?? [],
    time: data.time ?? '30 мин',
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
