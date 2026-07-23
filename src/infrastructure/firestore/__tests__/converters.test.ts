import { describe, it, expect, vi } from 'vitest';
import { timestampToISO, stringArray, type TimestampLike } from '../converters';

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

  it('warns when defaulting a missing createdAt', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    timestampToISO(null);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missing createdAt'));
    warn.mockRestore();
  });
});

describe('stringArray', () => {
  it('passes through an array of strings unchanged', () => {
    expect(stringArray(['Завтрак', 'Обед'], 'mealTypes', ['Ужин'])).toEqual(['Завтрак', 'Обед']);
  });

  it('returns the fallback when the field is missing', () => {
    expect(stringArray(undefined, 'mealTypes', ['Ужин'])).toEqual(['Ужин']);
  });

  it('returns the fallback when the value is not an array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(stringArray({ a: 1 }, 'mealTypes', ['Ужин'])).toEqual(['Ужин']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns the fallback when the array contains non-strings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(stringArray(['Завтрак', 42], 'mealTypes', ['Ужин'])).toEqual(['Ужин']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('passes through an empty array without falling back', () => {
    expect(stringArray([], 'allergies', ['молоко'])).toEqual([]);
  });
});
