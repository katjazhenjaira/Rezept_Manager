import { describe, it, expect } from 'vitest';
import { isStaple, BASIC_KEYWORDS } from '../staples';

describe('BASIC_KEYWORDS', () => {
  it('contains expected staple keywords', () => {
    expect(BASIC_KEYWORDS).toContain('соль');
    expect(BASIC_KEYWORDS).toContain('сахар');
    expect(BASIC_KEYWORDS).toContain('масло');
  });

  it('has 12 entries', () => {
    expect(BASIC_KEYWORDS).toHaveLength(12);
  });
});

describe('isStaple', () => {
  it('returns true for "Соль морская"', () => {
    expect(isStaple('Соль морская')).toBe(true);
  });

  it('returns true for "Оливковое масло" (case-insensitive)', () => {
    expect(isStaple('Оливковое масло')).toBe(true);
  });

  it('returns true for "ПЕРЕЦ черный"', () => {
    expect(isStaple('ПЕРЕЦ черный')).toBe(true);
  });

  it('returns true for "чеснок свежий" (contains "чеснок")', () => {
    expect(isStaple('чеснок свежий')).toBe(true);
  });

  it('returns false for "Куриная грудка"', () => {
    expect(isStaple('Куриная грудка')).toBe(false);
  });

  it('returns false for "Говядина"', () => {
    expect(isStaple('Говядина')).toBe(false);
  });

  it('returns false for "Брокколи"', () => {
    expect(isStaple('Брокколи')).toBe(false);
  });

  it('returns true for "питьевая вода"', () => {
    expect(isStaple('питьевая вода')).toBe(true);
  });
});
