import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateExternalUrl, safeFetch } from '../validateExternalUrl';

describe('validateExternalUrl', () => {
  it('accepts public https URLs and preserves path/query', () => {
    const result = validateExternalUrl('https://example.com/recipe?id=1');
    expect(result).not.toBeNull();
    expect(result?.href).toBe('https://example.com/recipe?id=1');
  });

  it('accepts public http URLs', () => {
    const result = validateExternalUrl('http://example.com/a');
    expect(result).not.toBeNull();
    expect(result?.protocol).toBe('http:');
  });

  it.each(['not a url', ''])('returns null for unparseable string %p', (raw) => {
    expect(validateExternalUrl(raw)).toBeNull();
  });

  it.each([
    'ftp://x.com/a',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/html,x',
  ])('rejects non-http(s) protocol: %s', (raw) => {
    expect(validateExternalUrl(raw)).toBeNull();
  });

  it('blocks localhost case-insensitively', () => {
    expect(validateExternalUrl('http://LOCALHOST:8080')).toBeNull();
    expect(validateExternalUrl('http://localhost')).toBeNull();
  });

  it('blocks 0.0.0.0', () => {
    expect(validateExternalUrl('http://0.0.0.0/')).toBeNull();
  });

  it('blocks *.local hostnames', () => {
    expect(validateExternalUrl('http://printer.local')).toBeNull();
  });

  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254', // cloud metadata
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '0.1.2.3', // 0.0.0.0/8
  ])('blocks private/loopback/link-local IPv4: %s', (host) => {
    expect(validateExternalUrl(`http://${host}/`)).toBeNull();
  });

  it.each(['8.8.8.8', '172.15.0.1', '172.32.0.1'])(
    'allows public IPv4 (boundary case): %s',
    (host) => {
      expect(validateExternalUrl(`http://${host}/`)).not.toBeNull();
    },
  );

  it.each(['[::1]', '[fc00::1]', '[fd12::1]', '[fe80::1]'])(
    'blocks private IPv6: %s',
    (host) => {
      expect(validateExternalUrl(`http://${host}/`)).toBeNull();
    },
  );

  // The WHATWG URL parser canonicalizes IPv4-mapped IPv6 literals to hex-group
  // form before validateExternalUrl ever sees the hostname — e.g.
  // `new URL('http://[::ffff:127.0.0.1]/').hostname` is `[::ffff:7f00:1]`,
  // never `[::ffff:127.0.0.1]`. isPrivateIPv6 must recognize the canonical hex
  // form too, not just dotted-decimal, or these private addresses slip through.
  it.each([
    '[::ffff:127.0.0.1]',
    '[::ffff:192.168.1.1]',
    '[::ffff:169.254.169.254]', // cloud metadata
    '[::ffff:10.0.0.1]',
    '[0:0:0:0:0:ffff:127.0.0.1]', // long form
    '[::FFFF:127.0.0.1]', // uppercase
    '[::ffff:7f00:1]', // direct hex-canonical form
  ])('blocks IPv4-mapped IPv6 of private addresses: %s', (host) => {
    expect(validateExternalUrl(`http://${host}/`)).toBeNull();
  });

  it('allows public IPv6', () => {
    expect(validateExternalUrl('http://[2606:4700::1111]/')).not.toBeNull();
  });

  it('allows public IPv4-mapped IPv6', () => {
    expect(validateExternalUrl('http://[::ffff:8.8.8.8]/')).not.toBeNull();
  });
});

describe('safeFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null without calling fetch for an invalid/private URL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetch('http://127.0.0.1/secret');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes redirect: manual and an AbortSignal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await safeFetch('https://example.com/');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.com/');
    expect(init.redirect).toBe('manual');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns the response for a non-redirect status', async () => {
    const okResponse = new Response('ok', { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(okResponse);
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetch('https://example.com/');

    expect(result).toBe(okResponse);
  });

  it('follows a 302 with absolute public Location (fetch called twice)', async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: { location: 'https://example.com/next' },
    });
    const final = new Response('final', { status: 200 });
    const fetchMock = vi.fn().mockResolvedValueOnce(redirect).mockResolvedValueOnce(final);
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetch('https://example.com/start');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toBe('https://example.com/next');
    expect(result).toBe(final);
  });

  it('resolves a relative Location against the current URL', async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: { location: '/next' },
    });
    const final = new Response('final', { status: 200 });
    const fetchMock = vi.fn().mockResolvedValueOnce(redirect).mockResolvedValueOnce(final);
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetch('https://example.com/start');

    expect(fetchMock.mock.calls[1]![0]).toBe('https://example.com/next');
    expect(result).toBe(final);
  });

  it('returns null when a redirect targets a private host (SSRF-via-redirect)', async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data' },
    });
    const fetchMock = vi.fn().mockResolvedValue(redirect);
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetch('https://example.com/start');

    expect(result).toBeNull();
    // Must not have followed the redirect to the private host.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null on 30x without a Location header', async () => {
    const redirect = new Response(null, { status: 302 });
    const fetchMock = vi.fn().mockResolvedValue(redirect);
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetch('https://example.com/start');

    expect(result).toBeNull();
  });

  it('stops after the redirect limit', async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: { location: 'https://example.com/' },
    });
    const fetchMock = vi.fn().mockResolvedValue(redirect);
    vi.stubGlobal('fetch', fetchMock);

    const result = await safeFetch('https://example.com/', {}, 5);

    expect(result).toBeNull();
    // hop = 0..maxRedirects inclusive => maxRedirects + 1 fetch calls.
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
