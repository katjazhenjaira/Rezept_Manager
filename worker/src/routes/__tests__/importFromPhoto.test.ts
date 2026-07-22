import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Env } from '../../types';
import type { ImportFromPhotoResponse } from '../../../../src/services/ai/contracts';

const generateContentMock = vi.fn();
vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>();
  return {
    ...actual,
    // A regular function (not an arrow fn) so `new GoogleGenAI(...)` works — vitest's
    // mock invokes this as a real constructor, and arrow functions can't be `new`-ed.
    GoogleGenAI: vi.fn(function () {
      return { models: { generateContent: generateContentMock } };
    }),
  };
});

// vi.mock calls are hoisted above imports, so importing the real app here is safe.
import app from '../../index';

const alwaysAllowKV = {
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
};
const env = { GEMINI_API_KEY: 'test-key', RATE_LIMIT_KV: alwaysAllowKV } as unknown as Env;

function post(body: unknown) {
  return app.request(
    '/api/ai/import-from-photo',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    env,
  );
}

const VALIDATION_ERROR = {
  error: 'Expected { images: Array<{ base64: string; mimeType: string }>, availableCategories: string[] }',
};

describe('POST /api/ai/import-from-photo', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('400 when images is missing/empty', async () => {
    const res = await post({ images: [], availableCategories: [] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(VALIDATION_ERROR);
  });

  it('400 when images is not an array', async () => {
    const res = await post({ images: 'nope', availableCategories: [] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(VALIDATION_ERROR);
  });

  it('400 when availableCategories is not an array', async () => {
    const res = await post({
      images: [{ base64: 'QUJD', mimeType: 'image/jpeg' }],
      availableCategories: 'nope',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(VALIDATION_ERROR);
  });

  it('400 when an image exceeds the 5MB base64 size guard', async () => {
    // byteLength ≈ floor(len * 3/4); 7,000,000 chars decodes to ~5.25MB, over the 5MB cap.
    const oversizeBase64 = 'A'.repeat(7_000_000);
    const res = await post({
      images: [{ base64: oversizeBase64, mimeType: 'image/jpeg' }],
      availableCategories: [],
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Image too large (max 5MB per image)' });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('200 happy path maps recipe fields from the model response', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        title: 'Омлет',
        ingredients: ['яйца'],
        steps: ['шаг'],
        time: '10 мин',
        calories: 200,
        proteins: 15,
        fats: 10,
        carbs: 5,
        categories: ['Завтрак'],
        servings: 1,
        sourceUrl: 'https://example.com/source',
        dishBoundingBox: { ymin: 0, xmin: 0, ymax: 500, xmax: 500 },
      }),
    });

    const res = await post({
      images: [{ base64: 'QUJD', mimeType: 'image/jpeg' }],
      availableCategories: ['Завтрак', 'Ужин'],
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ImportFromPhotoResponse;
    expect(body.recipe).toEqual({
      title: 'Омлет',
      sourceUrl: 'https://example.com/source',
      ingredients: ['яйца'],
      steps: ['шаг'],
      time: '10 мин',
      servings: 1,
      categories: ['Завтрак'],
      macros: { calories: 200, proteins: 15, fats: 10, carbs: 5 },
      dishBoundingBox: { ymin: 0, xmin: 0, ymax: 500, xmax: 500 },
    });
  });

  it('504 on upstream timeout', async () => {
    generateContentMock.mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));

    const res = await post({
      images: [{ base64: 'QUJD', mimeType: 'image/jpeg' }],
      availableCategories: [],
    });

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ error: 'Upstream request timed out' });
  });

  it('502 on generic upstream error without leaking details', async () => {
    generateContentMock.mockRejectedValue(new Error('boom'));

    const res = await post({
      images: [{ base64: 'QUJD', mimeType: 'image/jpeg' }],
      availableCategories: [],
    });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Failed to import recipe from photo' });
  });
});
