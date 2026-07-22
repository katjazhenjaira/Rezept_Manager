import { describe, it, expect, vi } from 'vitest';
import type { GoogleGenAI } from '@google/genai';
import { generateImageDataUri } from '../generateImageDataUri';

function makeFakeAi(generateContent: ReturnType<typeof vi.fn>) {
  return { models: { generateContent } } as unknown as GoogleGenAI;
}

describe('generateImageDataUri', () => {
  it('returns a data:image/...;base64,... string when a part has inlineData.data', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data: 'QUJD' } }],
          },
        },
      ],
    });
    const ai = makeFakeAi(generateContent);

    const result = await generateImageDataUri(ai, 'Borscht', ['beets', 'cabbage']);

    expect(result).toBe('data:image/png;base64,QUJD');
  });

  it('calls generateContent with the expected model, prompt and abort signal', async () => {
    const generateContent = vi.fn().mockResolvedValue({ candidates: [] });
    const ai = makeFakeAi(generateContent);

    await generateImageDataUri(ai, 'Borscht', ['beets', 'cabbage']);

    expect(generateContent).toHaveBeenCalledTimes(1);
    const call = generateContent.mock.calls[0]![0];
    expect(call.model).toBe('gemini-2.5-flash-image');
    expect(call.contents.parts[0].text).toContain('Borscht');
    expect(call.contents.parts[0].text).toContain('beets, cabbage');
    expect(call.config.abortSignal).toBeInstanceOf(AbortSignal);
    expect(call.config.imageConfig).toEqual({ aspectRatio: '4:3', imageSize: '1K' });
  });

  it('returns null when candidates are empty', async () => {
    const generateContent = vi.fn().mockResolvedValue({ candidates: [] });
    const ai = makeFakeAi(generateContent);

    const result = await generateImageDataUri(ai, 'Empty', []);

    expect(result).toBeNull();
  });

  it('returns null when no part has inlineData', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: 'no image here' }] } }],
    });
    const ai = makeFakeAi(generateContent);

    const result = await generateImageDataUri(ai, 'Empty', []);

    expect(result).toBeNull();
  });

  it('returns null when candidates/content/parts are entirely missing', async () => {
    const generateContent = vi.fn().mockResolvedValue({});
    const ai = makeFakeAi(generateContent);

    const result = await generateImageDataUri(ai, 'Empty', []);

    expect(result).toBeNull();
  });
});
