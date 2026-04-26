import type { Context } from "hono";
import { GoogleGenAI, Type } from "@google/genai";
import type {
  CalculateKbzhuRequest,
  CalculateKbzhuResponse,
} from "../../../src/services/ai/contracts";
import type { Env } from "../types";

export async function calculateKbzhu(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<CalculateKbzhuRequest>();
  const { ingredients } = body;

  if (typeof ingredients !== "string" || !ingredients.trim()) {
    return c.json({ error: "Expected { ingredients: string }" }, 400);
  }

  const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Calculate KBJU (calories, proteins, fats, carbs) for these ingredients: ${ingredients}. Return JSON with fields: calories, proteins, fats, carbs. Return ONLY JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          calories: { type: Type.NUMBER },
          proteins: { type: Type.NUMBER },
          fats: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
        },
        required: ["calories", "proteins", "fats", "carbs"],
      },
    },
  });

  const text = response.text ?? "{}";
  const parsed = JSON.parse(text) as Partial<CalculateKbzhuResponse>;

  const payload: CalculateKbzhuResponse = {
    calories: Number(parsed.calories ?? 0),
    proteins: Number(parsed.proteins ?? 0),
    fats: Number(parsed.fats ?? 0),
    carbs: Number(parsed.carbs ?? 0),
  };
  return c.json(payload);
}
