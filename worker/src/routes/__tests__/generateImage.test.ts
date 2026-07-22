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
    '/api/ai/generate-image',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    env,
  );
}

describe('POST /api/ai/generate-image', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('400 when title is missing', async () => {
    const res = await post({ ingredients: ['egg'] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Expected { title: string, ingredients: string[] }' });
  });

  it('400 when ingredients is not an array', async () => {
    const res = await post({ title: 'Borscht', ingredients: 'beets' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Expected { title: string, ingredients: string[] }' });
  });

  it('200 with a data URI when the model returns inline image data', async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ content: { parts: [{ inlineData: { data: 'QUJD', mimeType: 'image/png' } }] } }],
    });

    const res = await post({ title: 'Borscht', ingredients: ['beets', 'cabbage'] });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ imageDataUri: 'data:image/png;base64,QUJD' });
  });

  it('502 when the model yields no inline image data', async () => {
    generateContentMock.mockResolvedValue({ candidates: [] });

    const res = await post({ title: 'Borscht', ingredients: ['beets'] });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Gemini returned no inline image data' });
  });

  it('504 on upstream timeout', async () => {
    generateContentMock.mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));

    const res = await post({ title: 'Borscht', ingredients: ['beets'] });

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ error: 'Upstream request timed out' });
  });

  it('502 on generic upstream error without leaking details', async () => {
    generateContentMock.mockRejectedValue(new Error('boom'));

    const res = await post({ title: 'Borscht', ingredients: ['beets'] });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Failed to generate image' });
  });
});
