import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Env } from '../types';

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
import app from '../index';

const alwaysAllowKV = {
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
};
const baseEnv = { GEMINI_API_KEY: 'test-key', RATE_LIMIT_KV: alwaysAllowKV } as unknown as Env;

describe('worker app assembly (index.ts)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GET / returns the plain-text health check', async () => {
    const res = await app.request('/', {}, baseEnv);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Rezept Manager AI proxy');
  });

  it('malformed JSON body on a POST route is caught by app.onError -> generic 500', async () => {
    const res = await app.request(
      '/api/ai/calculate-kbzhu',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' },
      baseEnv,
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal error' });
    // The route body-throw must never reach generateContent.
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  describe('CORS', () => {
    it('echoes Access-Control-Allow-Origin for the allowed app origin', async () => {
      const res = await app.request(
        '/',
        { headers: { Origin: 'https://rezept-manager.flowgence.de' } },
        baseEnv,
      );
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://rezept-manager.flowgence.de',
      );
    });

    it('echoes Access-Control-Allow-Origin for the localhost dev origin', async () => {
      const res = await app.request('/', { headers: { Origin: 'http://localhost:5173' } }, baseEnv);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    });

    it('does not set Access-Control-Allow-Origin for a foreign origin', async () => {
      const res = await app.request('/', { headers: { Origin: 'https://evil.com' } }, baseEnv);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  describe('rate limiter mounted on /api/ai/*', () => {
    function createStatefulKv() {
      const store = new Map<string, string>();
      return {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => {
          store.set(key, value);
        }),
      };
    }

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      generateContentMock.mockReset();
      generateContentMock.mockResolvedValue({
        text: JSON.stringify({ calories: 100, proteins: 10, fats: 5, carbs: 20 }),
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('allows 10 requests per minute per IP and blocks the 11th with 429', async () => {
      const kv = createStatefulKv();
      const env = { GEMINI_API_KEY: 'test-key', RATE_LIMIT_KV: kv } as unknown as Env;

      for (let i = 0; i < 10; i++) {
        const res = await app.request(
          '/api/ai/calculate-kbzhu',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
            body: JSON.stringify({ ingredients: 'egg' }),
          },
          env,
        );
        expect(res.status).toBe(200);
      }

      const eleventh = await app.request(
        '/api/ai/calculate-kbzhu',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
          body: JSON.stringify({ ingredients: 'egg' }),
        },
        env,
      );

      expect(eleventh.status).toBe(429);
      expect(await eleventh.json()).toEqual({
        error: 'Rate limit exceeded. Maximum 10 requests per minute.',
      });
    });
  });
});
