import { GoogleGenAI } from "@google/genai";

export async function generateImageDataUri(
  ai: GoogleGenAI,
  title: string,
  ingredients: string[]
): Promise<string | null> {
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
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
}
