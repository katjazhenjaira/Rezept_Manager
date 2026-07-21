import type { Context } from 'hono';
import { GoogleGenAI } from '@google/genai';
import type {
  GenerateImageRequest,
  GenerateImageResponse,
} from '../../../src/services/ai/contracts';
import { generateImageDataUri } from '../helpers/generateImageDataUri';
import { isTimeoutError } from '../helpers/timeout';
import type { Env } from '../types';

export async function generateImage(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<GenerateImageRequest>();
  const { title, ingredients } = body;

  if (!title || !Array.isArray(ingredients)) {
    return c.json({ error: 'Expected { title: string, ingredients: string[] }' }, 400);
  }

  const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });

  let dataUri: string | null;
  try {
    dataUri = await generateImageDataUri(ai, title, ingredients);
  } catch (err) {
    console.error('[generateImage] error:', err);
    if (isTimeoutError(err)) return c.json({ error: 'Upstream request timed out' }, 504);
    return c.json({ error: 'Failed to generate image' }, 502);
  }

  if (!dataUri) {
    return c.json({ error: 'Gemini returned no inline image data' }, 502);
  }

  const payload: GenerateImageResponse = { imageDataUri: dataUri };
  return c.json(payload);
}
