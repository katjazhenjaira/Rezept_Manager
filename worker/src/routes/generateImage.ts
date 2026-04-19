import type { Context } from "hono";
import { GoogleGenAI } from "@google/genai";
import type {
  GenerateImageRequest,
  GenerateImageResponse,
} from "../../../src/services/ai/contracts";

type Bindings = { GEMINI_API_KEY: string };

export async function generateImage(c: Context<{ Bindings: Bindings }>) {
  const body = await c.req.json<GenerateImageRequest>();
  const { title, ingredients } = body;

  if (!title || !Array.isArray(ingredients)) {
    return c.json({ error: "Expected { title: string, ingredients: string[] }" }, 400);
  }

  const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
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
      const payload: GenerateImageResponse = {
        imageDataUri: `data:image/png;base64,${part.inlineData.data}`,
      };
      return c.json(payload);
    }
  }

  return c.json({ error: "Gemini returned no inline image data" }, 502);
}
