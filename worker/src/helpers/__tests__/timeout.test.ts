import { describe, it, expect } from 'vitest';
import { UPSTREAM_TIMEOUT_MS, isTimeoutError } from '../timeout';

describe('UPSTREAM_TIMEOUT_MS', () => {
  it('equals 25 seconds', () => {
    expect(UPSTREAM_TIMEOUT_MS).toBe(25_000);
  });
});

describe('isTimeoutError', () => {
  it('returns true for a DOMException-style TimeoutError', () => {
    const err = new DOMException('The operation timed out.', 'TimeoutError');
    expect(isTimeoutError(err)).toBe(true);
  });

  it('returns true for a DOMException-style AbortError', () => {
    const err = new DOMException('The operation was aborted.', 'AbortError');
    expect(isTimeoutError(err)).toBe(true);
  });

  it('returns true for a plain Error named TimeoutError', () => {
    const err = new Error('timed out');
    err.name = 'TimeoutError';
    expect(isTimeoutError(err)).toBe(true);
  });

  it('returns true for a plain Error named AbortError', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    expect(isTimeoutError(err)).toBe(true);
  });

  it('returns false for a plain Error with default name', () => {
    expect(isTimeoutError(new Error('x'))).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isTimeoutError('TimeoutError')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isTimeoutError(undefined)).toBe(false);
  });
});
