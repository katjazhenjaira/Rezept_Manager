import type { Context } from "hono";
import { GoogleGenAI } from "@google/genai";
import type {
  FillRemainingRequest,
  FillRemainingResponse,
  FillRemainingOption,
} from "../../../src/services/ai/contracts";
import type { Env } from "../types";

export async function fillRemaining(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<FillRemainingRequest>();
  const { remaining, planName, allergies, activeProgramRules, userRecipes } = body;

  if (!remaining || typeof remaining.calories !== "number") {
    return c.json({ error: "Expected { remaining: Macros, planName: string, allergies: string[], userRecipes: [...] }" }, 400);
  }

  const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });

  const allowedText =
    activeProgramRules?.allowedProducts && activeProgramRules.allowedProducts.length > 0
      ? `Разрешенные продукты: ${activeProgramRules.allowedProducts.join(", ")}.`
      : "";
  const forbiddenText =
    activeProgramRules?.forbiddenProducts && activeProgramRules.forbiddenProducts.length > 0
      ? `Запрещенные продукты: ${activeProgramRules.forbiddenProducts.join(", ")}.`
      : "";
  const allergiesText = allergies.length > 0 ? allergies.join(", ") : "нет";
  const recipesText = userRecipes
    .map((r) => `${r.title} (ID: ${r.id}, КБЖУ на порцию: ${r.macros.calories}/${r.macros.proteins}/${r.macros.fats}/${r.macros.carbs})`)
    .join(", ");

  const prompt = `У меня осталось ${remaining.calories} ккал, ${remaining.proteins}г белков, ${remaining.fats}г жиров, ${remaining.carbs}г углеводов на сегодня.
Посоветуй 3 варианта перекуса.
ТЕКУЩИЙ ПЛАН ПИТАНИЯ: ${planName}.
${allowedText}
${forbiddenText}
ВАЖНО: Ты ДОЛЖЕН строго следовать текущему плану питания.
Если указаны разрешенные продукты, предлагай ТОЛЬКО их или комбинации из них.
Если указаны запрещенные продукты, НИКОГДА их не предлагай.
Если выбираешь рецепт из списка, укажи его ID и адаптируй порцию так, чтобы она вписалась в остаток.
Если это комбинация продуктов, опиши их (например: "1 жменя миндаля и 1 морковка 30г").
Учитывай мои аллергии и непереносимости: ${allergiesText}.
Мои рецепты: ${recipesText}

Верни ответ в формате JSON:
{
  "options": [
    {
      "id": "unique_string_id",
      "type": "recipe" | "product",
      "recipeId": "id если это рецепт",
      "description": "название блюда или описание продуктов (включая количество/вес)",
      "macros": { "calories": number, "proteins": number, "fats": number, "carbs": number }
    }
  ],
  "reason": "краткое пояснение, почему эти варианты подходят"
}`;

  let data: { options?: FillRemainingOption[]; reason?: string };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    data = JSON.parse(response.text ?? "{}") as typeof data;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Gemini error: ${message}` }, 502);
  }

  const payload: FillRemainingResponse = {
    options: data.options ?? [],
    reason: data.reason ?? "",
  };
  return c.json(payload);
}
