// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import i18n, { STORAGE_KEY } from '../i18nConfig';
import { I18nProvider } from '../I18nProvider';

function LanguageProbe() {
  const { i18n: instance } = useTranslation();
  return <span data-testid="lang">{instance.language}</span>;
}

describe('I18nProvider', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('ru');
  });

  afterEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('ru');
  });

  it('applies the language saved in localStorage on mount', async () => {
    localStorage.setItem(STORAGE_KEY, 'de');

    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('lang').textContent).toBe('de'));
  });

  it('keeps the current language when nothing is saved', async () => {
    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('lang').textContent).toBe('ru'));
  });

  it('ignores a saved language equal to the current one (no redundant switch)', async () => {
    localStorage.setItem(STORAGE_KEY, 'ru');

    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('lang').textContent).toBe('ru'));
  });
});
