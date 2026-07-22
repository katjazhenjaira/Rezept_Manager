// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import i18n, { changeLanguage, STORAGE_KEY } from '../i18nConfig';

describe('i18nConfig', () => {
  it('exposes the localStorage key used to persist the language', () => {
    expect(STORAGE_KEY).toBe('rm_language');
  });

  it('changeLanguage updates i18n.language and persists to localStorage', async () => {
    changeLanguage('de');
    // changeLanguage() (module fn) fires i18n.changeLanguage() without awaiting it;
    // re-invoking on the i18n instance directly and awaiting flushes the same
    // (idempotent) transition so we can assert the settled state.
    await i18n.changeLanguage('de');

    expect(i18n.language).toBe('de');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('de');
  });

  it('changeLanguage can switch to "en" and back to "ru", persisting each time', async () => {
    changeLanguage('en');
    await i18n.changeLanguage('en');
    expect(i18n.language).toBe('en');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en');

    changeLanguage('ru');
    await i18n.changeLanguage('ru');
    expect(i18n.language).toBe('ru');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('ru');
  });

  // Note: the module also picks its *initial* `lng` from a pre-seeded
  // localStorage[STORAGE_KEY] at i18n.init() time (module load). That path is
  // inherently order-dependent on when the module is first imported relative
  // to localStorage being seeded, and is not exercised here — only the
  // changeLanguage() runtime path is covered above.
});
