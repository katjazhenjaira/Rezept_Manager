/**
 * Upper bound for a single upstream request — Gemini `generateContent()` or a
 * client-supplied URL fetch. Without this, a hanging upstream request holds the
 * Worker open indefinitely with no client-visible signal beyond Cloudflare's
 * platform-level limits (PERF-7).
 */
export const UPSTREAM_TIMEOUT_MS = 25_000;

export function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
}
