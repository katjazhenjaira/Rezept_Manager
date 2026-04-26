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

  if (typeof url !== "string" || !url.trim() || !Array.isArray(availableCategories)) {
    return c.json({ error: "Expected { url: string, availableCategories: string[] }" }, 400);
  }

  const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });

  let data: {
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
  try {
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
    data = JSON.parse(response.text ?? "{}") as typeof data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Gemini error: ${message}` }, 502);
  }

  let dishImage: string | undefined;

  // Download the image server-side to avoid hotlink protection on external CDNs.
  // Spoof Referer to the source page so CDN treats it as a legitimate request.
  // Build a list of image URLs to try: og:image from HTML first, then Gemini's guess.
  // og:image is designed for external crawlers and is more reliably accessible.
  const imageUrlCandidates: string[] = [];

  try {
    const pageResp = await fetch(url, {
      headers: {
        // Social-crawler UA that sites typically allow for og:image access.
        "User-Agent": "facebookexternalhit/1.1",
        Accept: "text/html",
      },
    });
    if (pageResp.ok) {
      const html = await pageResp.text();
      const ogMatch =
        html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ??
        html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (ogMatch?.[1]) imageUrlCandidates.push(ogMatch[1]);
    }
  } catch {}

  if (data.imageUrl) imageUrlCandidates.push(data.imageUrl);

  for (const candidate of imageUrlCandidates) {
    try {
      const imgResp = await fetch(candidate, { headers: { Referer: url } });
      if (!imgResp.ok) continue;
      const buffer = await imgResp.arrayBuffer();
      if (buffer.byteLength > 600_000) continue;
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const contentType = imgResp.headers.get("content-type") ?? "image/jpeg";
      dishImage = `data:${contentType};base64,${base64}`;
      break;
    } catch {}
  }

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
    sourceUrl: url,
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
    dishImage,
  };

  const payload: ImportFromUrlResponse = { recipe };
  return c.json(payload);
}
