import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Env } from '../../types';
import type { ImportFromPdfResponse } from '../../../../src/services/ai/contracts';

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
    '/api/ai/import-from-pdf',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    env,
  );
}

describe('POST /api/ai/import-from-pdf', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('400 when neither pdfBase64 nor pdfText is provided', async () => {
    const res = await post({ availableCategories: [] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Expected pdfBase64 or pdfText' });
  });

  it('400 when availableCategories is not an array', async () => {
    const res = await post({ pdfText: 'some extracted text', availableCategories: 'nope' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Expected availableCategories: string[]' });
  });

  it('200 happy path via the pdfText branch maps recipe fields and category casing', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        recipes: [
          {
            title: 'Пирог',
            author: 'Bабушка',
            ingredients: ['мука', 'яблоки'],
            steps: ['шаг1', 'шаг2'],
            time: '1 час',
            calories: 400,
            proteins: 8,
            fats: 20,
            carbs: 50,
            categories: ['ЗАВТРАК'],
            servings: 6,
            pageNumber: 2,
            dishBoundingBox: { ymin: 10, xmin: 10, ymax: 400, xmax: 400 },
          },
        ],
      }),
    });

    const res = await post({ pdfText: 'extracted pdf text', availableCategories: ['Завтрак', 'Ужин'] });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ImportFromPdfResponse;
    expect(body.recipes).toHaveLength(1);
    expect(body.recipes[0]).toEqual({
      title: 'Пирог',
      author: 'Bабушка',
      ingredients: ['мука', 'яблоки'],
      steps: ['шаг1', 'шаг2'],
      time: '1 час',
      servings: 6,
      categories: ['Завтрак'],
      macros: { calories: 400, proteins: 8, fats: 20, carbs: 50 },
      pageNumber: 2,
      dishBoundingBox: { ymin: 10, xmin: 10, ymax: 400, xmax: 400 },
    });
  });

  it('200 happy path via the pdfBase64 branch', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ recipes: [{ title: 'Суп', ingredients: [], steps: [], time: '20 мин', calories: 0, proteins: 0, fats: 0, carbs: 0, categories: [], servings: 2 }] }),
    });

    const res = await post({ pdfBase64: 'JVBERi0xLjQK', availableCategories: [] });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ImportFromPdfResponse;
    expect(body.recipes[0]!.title).toBe('Суп');
  });

  it('applies defaults when recipe fields are omitted', async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ recipes: [{}] }) });

    const res = await post({ pdfText: 'x', availableCategories: [] });

    expect(res.status).toBe(200);
    const body = (await res.json()) as ImportFromPdfResponse;
    expect(body.recipes[0]).toMatchObject({
      title: 'Новый рецепт',
      time: '30 мин',
      servings: 2,
      ingredients: [],
      steps: [],
      categories: [],
      macros: { calories: 0, proteins: 0, fats: 0, carbs: 0 },
    });
  });

  it('defaults recipes to an empty array when the model omits the field entirely', async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({}) });

    const res = await post({ pdfText: 'x', availableCategories: [] });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ recipes: [] });
  });

  it('504 on upstream timeout', async () => {
    generateContentMock.mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));

    const res = await post({ pdfText: 'x', availableCategories: [] });

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ error: 'Upstream request timed out' });
  });

  it('502 on generic upstream error without leaking details', async () => {
    generateContentMock.mockRejectedValue(new Error('boom'));

    const res = await post({ pdfText: 'x', availableCategories: [] });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Failed to import recipe from PDF' });
  });
});
