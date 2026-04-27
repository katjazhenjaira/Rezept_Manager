import { describe, it, expect } from 'vitest';
import { timestampToISO, type TimestampLike } from '../converters';

describe('timestampToISO', () => {
  it('passes through an ISO string unchanged', () => {
    const iso = '2026-04-27T10:00:00.000Z';
    expect(timestampToISO(iso)).toBe(iso);
  });

  it('returns current-ish ISO string for null', () => {
    const before = Date.now();
    const result = timestampToISO(null);
    const after = Date.now();
    const ms = new Date(result).getTime();
    expect(ms).toBeGreaterThanOrEqual(before);
    expect(ms).toBeLessThanOrEqual(after);
  });

  it('returns current-ish ISO string for undefined', () => {
    const before = Date.now();
    const result = timestampToISO(undefined);
    const after = Date.now();
    const ms = new Date(result).getTime();
    expect(ms).toBeGreaterThanOrEqual(before);
    expect(ms).toBeLessThanOrEqual(after);
  });

  it('converts a Firestore-Timestamp-shaped object via toDate()', () => {
    const fakeTimestamp = { toDate: () => new Date('2026-01-15T08:30:00.000Z') };
    expect(timestampToISO(fakeTimestamp as TimestampLike)).toBe('2026-01-15T08:30:00.000Z');
  });

  it('passes through empty string unchanged', () => {
    expect(timestampToISO('')).toBe('');
  });
});
