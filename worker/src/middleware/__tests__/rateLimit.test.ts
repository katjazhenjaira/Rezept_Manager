import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../../types';
import { rateLimit } from '../rateLimit';

// 2024-01-01T00:00:00.000Z — a clean minute boundary so the minute bucket
// (Math.floor(Date.now() / 60_000)) is easy to reason about by hand.
const FIXED_TIME_MS = 1704067200000;
const EXPECTED_MINUTE = 28401120; // 1704067200000 / 60000

function createFakeKv(getReturn: string | null) {
  return {
    get: vi.fn().mockResolvedValue(getReturn),
    put: vi.fn().mockResolvedValue(undefined),
  };
}

function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.use('*', rateLimit);
  app.get('/x', (c) => c.text('ok'));
  return app;
}

function makeEnv(kv: ReturnType<typeof createFakeKv>): Env {
  return {
    GEMINI_API_KEY: 'k',
    RATE_LIMIT_KV: kv as unknown as Env['RATE_LIMIT_KV'],
  };
}

describe('rateLimit middleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TIME_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes through without calling KV when no client-IP header is present', async () => {
    const kv = createFakeKv(null);
    const app = createApp();

    const res = await app.request('/x', {}, makeEnv(kv));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('first request: get returns null, put is called with count "1" and TTL 65', async () => {
    const kv = createFakeKv(null);
    const app = createApp();

    const res = await app.request(
      '/x',
      { headers: { 'CF-Connecting-IP': '1.2.3.4' } },
      makeEnv(kv),
    );

    expect(res.status).toBe(200);
    expect(kv.get).toHaveBeenCalledWith(`rate:1.2.3.4:${EXPECTED_MINUTE}`);
    expect(kv.put).toHaveBeenCalledWith(`rate:1.2.3.4:${EXPECTED_MINUTE}`, '1', {
      expirationTtl: 65,
    });
  });

  it('existing count increments: get "9" => put "10", request still passes (200)', async () => {
    const kv = createFakeKv('9');
    const app = createApp();

    const res = await app.request(
      '/x',
      { headers: { 'CF-Connecting-IP': '1.2.3.4' } },
      makeEnv(kv),
    );

    expect(res.status).toBe(200);
    expect(kv.put).toHaveBeenCalledWith(`rate:1.2.3.4:${EXPECTED_MINUTE}`, '10', {
      expirationTtl: 65,
    });
  });

  it('count at limit (10) => 429, no put, Retry-After header set', async () => {
    const kv = createFakeKv('10');
    const app = createApp();

    const res = await app.request(
      '/x',
      { headers: { 'CF-Connecting-IP': '1.2.3.4' } },
      makeEnv(kv),
    );

    expect(res.status).toBe(429);
    expect(kv.put).not.toHaveBeenCalled();
    // Date.now() at FIXED_TIME_MS is exactly on a minute boundary (0 seconds
    // into the minute), so secondsUntilNextMinute = 60 - 0 = 60.
    expect(res.headers.get('Retry-After')).toBe('60');
    const body = await res.json();
    expect(body).toEqual({ error: 'Rate limit exceeded. Maximum 10 requests per minute.' });
  });

  it('corrupt KV value ("garbage") is treated as count 0', async () => {
    const kv = createFakeKv('garbage');
    const app = createApp();

    const res = await app.request(
      '/x',
      { headers: { 'CF-Connecting-IP': '1.2.3.4' } },
      makeEnv(kv),
    );

    expect(res.status).toBe(200);
    expect(kv.put).toHaveBeenCalledWith(`rate:1.2.3.4:${EXPECTED_MINUTE}`, '1', {
      expirationTtl: 65,
    });
  });

  it('X-Forwarded-For with multiple IPs uses the first entry in the key', async () => {
    const kv = createFakeKv(null);
    const app = createApp();

    await app.request(
      '/x',
      { headers: { 'X-Forwarded-For': '5.6.7.8, 9.9.9.9, 10.10.10.10' } },
      makeEnv(kv),
    );

    expect(kv.get).toHaveBeenCalledWith(`rate:5.6.7.8:${EXPECTED_MINUTE}`);
  });

  it('advancing system time by 60s changes the minute bucket in the key', async () => {
    const kv = createFakeKv(null);
    const app = createApp();

    vi.setSystemTime(FIXED_TIME_MS + 60_000);

    await app.request(
      '/x',
      { headers: { 'CF-Connecting-IP': '1.2.3.4' } },
      makeEnv(kv),
    );

    expect(kv.get).toHaveBeenCalledWith(`rate:1.2.3.4:${EXPECTED_MINUTE + 1}`);
  });
});
