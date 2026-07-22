import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Env } from '../../types';
import type { ImportFromUrlResponse } from '../../../../src/services/ai/contracts';

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
    '/api/ai/import-from-url',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    env,
  );
}

describe('POST /api/ai/import-from-url', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    // og:image fetch and image-download loop both hit this — a 404 short-circuits
    // both branches deterministically, keeping tests on the JSON-mapping path.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('400 when url is missing', async () => {
    const res = await post({ availableCategories: [] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Expected { url: string, availableCategories: string[] }' });
  });

  it('400 when availableCategories is not an array', async () => {
    const res = await post({ url: 'https://example.com/recipe', availableCategories: 'nope' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Expected { url: string, availableCategories: string[] }' });
  });

  it('400 for a private URL (SSRF guard)', async () => {
    const res = await post({ url: 'http://127.0.0.1/x', availableCategories: [] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'URL must be http(s) and point to a public host' });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('200 happy path maps recipe fields from the model response', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        title: 'Борщ',
        author: 'Chef',
        ingredients: ['свекла', 'капуста'],
        steps: ['шаг1'],
        time: '40 мин',
        calories: 300,
        proteins: 10,
        fats: 5,
        carbs: 40,
        categories: ['Завтрак'],
        servings: 4,
      }),
    });

    const res = await post({
      url: 'https://example.com/recipe',
      availableCategories: ['Завтрак', 'Ужин'],
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ImportFromUrlResponse;
    expect(body.recipe).toMatchObject({
      title: 'Борщ',
      author: 'Chef',
      sourceUrl: 'https://example.com/recipe',
      ingredients: ['свекла', 'капуста'],
      steps: ['шаг1'],
      time: '40 мин',
      servings: 4,
      categories: ['Завтрак'],
      macros: { calories: 300, proteins: 10, fats: 5, carbs: 40 },
    });
    // fetch is 404'd and the mocked generateContent response has no candidates/inlineData,
    // so the AI-fallback image path also yields nothing.
    expect(body.recipe.dishImage).toBeUndefined();
  });

  it('applies defaults when fields are omitted from the model response', async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({}) });

    const res = await post({ url: 'https://example.com/recipe', availableCategories: ['Завтрак'] });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ImportFromUrlResponse;
    expect(body.recipe).toMatchObject({
      title: 'Новый рецепт',
      time: '30 мин',
      servings: 2,
      ingredients: [],
      steps: [],
      categories: [],
      macros: { calories: 0, proteins: 0, fats: 0, carbs: 0 },
    });
  });

  it('maps categories case-insensitively and drops unknown ones', async () => {
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
        categories: ['ЗАВТРАК', 'Nonsense'],
        servings: 1,
      }),
    });

    const res = await post({
      url: 'https://example.com/omelette',
      availableCategories: ['Завтрак', 'Ужин'],
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ImportFromUrlResponse;
    expect(body.recipe.categories).toEqual(['Завтрак']);
  });

  it('504 on upstream timeout', async () => {
    generateContentMock.mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));

    const res = await post({ url: 'https://example.com/recipe', availableCategories: [] });

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ error: 'Upstream request timed out' });
  });

  it('502 on generic upstream error without leaking details', async () => {
    generateContentMock.mockRejectedValue(new Error('boom'));

    const res = await post({ url: 'https://example.com/recipe', availableCategories: [] });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Failed to import recipe from URL' });
  });
});
