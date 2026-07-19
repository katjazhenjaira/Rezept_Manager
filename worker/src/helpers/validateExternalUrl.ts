const PRIVATE_HOSTNAMES = new Set(["localhost", "0.0.0.0"]);

function isPrivateIPv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIPv6(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::" || h === "::1" || h === "::0") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(h)) return true; // fe80::/10 link-local

  // IPv4-mapped/compatible addresses (::ffff:a.b.c.d or ::a.b.c.d) inherit the IPv4 address's privacy.
  const mappedV4 = h.match(/^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)?.[1];
  if (mappedV4 && isPrivateIPv4(mappedV4)) return true;

  return false;
}

/**
 * Blocks SSRF via literal loopback/private/link-local hosts. Cannot catch
 * DNS rebinding (hostname resolving to a private IP at fetch time) since
 * Workers have no synchronous DNS lookup — this covers the direct case only.
 */
export function validateExternalUrl(rawUrl: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const hostname = parsed.hostname.toLowerCase();
  if (PRIVATE_HOSTNAMES.has(hostname)) return null;
  if (hostname.endsWith(".local")) return null;
  if (isPrivateIPv4(hostname)) return null;
  if (hostname.includes(":") && isPrivateIPv6(hostname)) return null;

  return parsed;
}

/**
 * Fetches a client-supplied URL while re-validating every redirect hop, so a
 * validated URL can't 30x its way to a private/link-local host. Follows
 * redirects manually instead of letting `fetch` auto-follow them.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  maxRedirects = 5,
): Promise<Response | null> {
  let current = validateExternalUrl(rawUrl);
  if (!current) return null;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const resp = await fetch(current.href, { ...init, redirect: "manual" });
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      if (!location) return null;
      let next: URL | null;
      try {
        next = validateExternalUrl(new URL(location, current.href).href);
      } catch {
        next = null;
      }
      if (!next) return null;
      current = next;
      continue;
    }
    return resp;
  }
  return null;
}
