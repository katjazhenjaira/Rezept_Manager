import { describe, it, expect, afterEach, vi } from 'vitest';
import { aiClient } from '../aiClient';
import type {
  ImportFromUrlRequest,
  ImportFromPdfRequest,
  ImportFromPhotoRequest,
  GenerateImageRequest,
  CalculateKbzhuRequest,
  FillRemainingRequest,
} from '../contracts';

type FakeResponse = {
  ok: boolean;
  status?: number;
  statusText?: string;
  json: () => Promise<unknown>;
};

function stubFetch(response: FakeResponse) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('aiClient', () => {
  const cases: Array<{
    name: keyof typeof aiClient;
    pathSuffix: string;
    body: unknown;
  }> = [
    {
      name: 'importFromUrl',
      pathSuffix: '/import-from-url',
      body: { url: 'https://example.com', availableCategories: [] } satisfies ImportFromUrlRequest,
    },
    {
      name: 'importFromPdf',
      pathSuffix: '/import-from-pdf',
      body: { pdfText: 'text', availableCategories: [] } satisfies ImportFromPdfRequest,
    },
    {
      name: 'importFromPhoto',
      pathSuffix: '/import-from-photo',
      body: {
        images: [{ base64: 'abc', mimeType: 'image/png' }],
        availableCategories: [],
      } satisfies ImportFromPhotoRequest,
    },
    {
      name: 'generateImage',
      pathSuffix: '/generate-image',
      body: { title: 'Soup', ingredients: ['water'] } satisfies GenerateImageRequest,
    },
    {
      name: 'calculateKbzhu',
      pathSuffix: '/calculate-kbzhu',
      body: { ingredients: '100g rice' } satisfies CalculateKbzhuRequest,
    },
    {
      name: 'fillRemaining',
      pathSuffix: '/fill-remaining',
      body: {
        remaining: { calories: 100, proteins: 1, fats: 1, carbs: 1 },
        planName: 'Default',
        allergies: [],
        userRecipes: [],
      } satisfies FillRemainingRequest,
    },
  ];

  it.each(cases)('$name posts to the correct path with JSON body', async ({ name, pathSuffix, body }) => {
    const fetchMock = stubFetch({ ok: true, json: async () => ({ result: 'ok' }) });

    const method = aiClient[name] as (req: unknown) => Promise<unknown>;
    const result = await method(body);

    expect(result).toEqual({ result: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toEqual(expect.stringContaining(pathSuffix));
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify(body));
  });

  it('resolves with the parsed JSON body on an ok response', async () => {
    stubFetch({ ok: true, json: async () => ({ calories: 100, proteins: 1, fats: 1, carbs: 1 }) });

    const result = await aiClient.calculateKbzhu({ ingredients: '1 egg' });

    expect(result).toEqual({ calories: 100, proteins: 1, fats: 1, carbs: 1 });
  });

  it('throws using the JSON error body message when the response is not ok', async () => {
    stubFetch({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Rate limit exceeded' }),
    });

    await expect(aiClient.calculateKbzhu({ ingredients: '1 egg' })).rejects.toThrow(
      'AI proxy /calculate-kbzhu failed: 429 Rate limit exceeded',
    );
  });

  it('falls back to statusText when the error body is not valid JSON', async () => {
    stubFetch({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(aiClient.calculateKbzhu({ ingredients: '1 egg' })).rejects.toThrow(
      'AI proxy /calculate-kbzhu failed: 500 Internal Server Error',
    );
  });
});
