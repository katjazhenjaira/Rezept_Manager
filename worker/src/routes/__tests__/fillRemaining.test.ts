import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Env } from '../../types';
import type { FillRemainingResponse } from '../../../../src/services/ai/contracts';

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
    '/api/ai/fill-remaining',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    env,
  );
}

const validBody = {
  remaining: { calories: 500, proteins: 30, fats: 20, carbs: 50 },
  planName: 'Plan A',
  allergies: ['nuts'],
  userRecipes: [{ id: 'r1', title: 'Salad', macros: { calories: 100, proteins: 5, fats: 2, carbs: 10 } }],
};

function threeOptions() {
  return [
    { id: '1', type: 'product', description: 'Option 1', macros: { calories: 100, proteins: 5, fats: 2, carbs: 10 } },
    { id: '2', type: 'product', description: 'Option 2', macros: { calories: 150, proteins: 8, fats: 3, carbs: 15 } },
    { id: '3', type: 'recipe', recipeId: 'r1', description: 'Option 3', macros: { calories: 200, proteins: 10, fats: 5, carbs: 20 } },
  ];
}

describe('POST /api/ai/fill-remaining', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('400 when remaining is missing', async () => {
    const { remaining: _remaining, ...rest } = validBody;
    const res = await post(rest);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Expected { remaining: Macros, planName: string, allergies: string[], userRecipes: [...] }',
    });
  });

  it('400 when remaining.calories is not a number', async () => {
    const res = await post({ ...validBody, remaining: { ...validBody.remaining, calories: '500' } });
    expect(res.status).toBe(400);
  });

  it('400 when allergies is not an array', async () => {
    const res = await post({ ...validBody, allergies: 'nuts' });
    expect(res.status).toBe(400);
  });

  it('400 when userRecipes is not an array', async () => {
    const res = await post({ ...validBody, userRecipes: null });
    expect(res.status).toBe(400);
  });

  it('200 happy path returns the 3 options and reason built from the model response', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ options: threeOptions(), reason: 'fits your macros' }),
    });

    const res = await post(validBody);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ options: threeOptions(), reason: 'fits your macros' });
  });

  it('reason defaults to empty string when absent from the model response', async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ options: threeOptions() }) });

    const res = await post(validBody);

    expect(res.status).toBe(200);
    const body = (await res.json()) as FillRemainingResponse;
    expect(body.reason).toBe('');
  });

  it('502 when the model returns a number of options other than 3', async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ options: threeOptions().slice(0, 2), reason: 'x' }),
    });

    const res = await post(validBody);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'AI response did not contain exactly 3 options' });
  });

  it('504 on upstream timeout', async () => {
    generateContentMock.mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));

    const res = await post(validBody);

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ error: 'Upstream request timed out' });
  });

  it('502 on generic upstream error without leaking details', async () => {
    generateContentMock.mockRejectedValue(new Error('boom'));

    const res = await post(validBody);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Failed to generate suggestions' });
  });
});
