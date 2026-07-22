import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Env } from '../../types';

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
    '/api/ai/calculate-kbzhu',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    env,
  );
}

describe('POST /api/ai/calculate-kbzhu', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('400 when ingredients is missing', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Expected { ingredients: string }' });
  });

  it('400 when ingredients is an empty/whitespace string', async () => {
    const res = await post({ ingredients: '   ' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Expected { ingredients: string }' });
  });

  it('400 when ingredients is not a string', async () => {
    const res = await post({ ingredients: 123 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Expected { ingredients: string }' });
  });

  it('200 happy path maps calories/proteins/fats/carbs to numbers', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ calories: 100, proteins: 10, fats: 5, carbs: 20 }),
    });

    const res = await post({ ingredients: '2 eggs, 100g rice' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ calories: 100, proteins: 10, fats: 5, carbs: 20 });
  });

  it('missing fields in the model response default to 0', async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({}) });

    const res = await post({ ingredients: 'water' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ calories: 0, proteins: 0, fats: 0, carbs: 0 });
  });

  it('504 on upstream timeout', async () => {
    generateContentMock.mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));

    const res = await post({ ingredients: 'egg' });

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ error: 'Upstream request timed out' });
  });

  it('502 on generic upstream error without leaking details', async () => {
    generateContentMock.mockRejectedValue(new Error('boom'));

    const res = await post({ ingredients: 'egg' });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Failed to calculate KBJU' });
  });
});
