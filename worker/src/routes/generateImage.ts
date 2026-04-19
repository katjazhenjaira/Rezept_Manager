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
