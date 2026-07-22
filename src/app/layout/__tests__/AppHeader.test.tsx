// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// Side-effect import: инициализирует глобальный i18next (ru), как I18nProvider в приложении.
import i18n, { STORAGE_KEY } from '@/app/providers/i18nConfig';
import { AppHeader } from '../AppHeader';

describe('AppHeader', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('ru');
  });

  afterEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('ru');
  });

  it('renders the app title', () => {
    render(<AppHeader onOpenSettings={vi.fn()} />);
    expect(screen.getByText('Рецепт Менеджер')).toBeInTheDocument();
  });

  it('opens settings on the gear button', () => {
    const onOpenSettings = vi.fn();
    render(<AppHeader onOpenSettings={onOpenSettings} />);

    // Кнопка настроек — последняя в шапке (перед ней только переключатель языка).
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]!);

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('hides the language dropdown until the flag button is clicked', () => {
    render(<AppHeader onOpenSettings={vi.fn()} />);
    expect(screen.queryByText('Deutsch')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button')[0]!);

    expect(screen.getByText('Русский')).toBeInTheDocument();
    expect(screen.getByText('Deutsch')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('switches the language and persists the choice', async () => {
    render(<AppHeader onOpenSettings={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button')[0]!);
    fireEvent.click(screen.getByText('Deutsch'));

    await waitFor(() => expect(i18n.language).toBe('de'));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('de');
    expect(screen.queryByText('Deutsch')).not.toBeInTheDocument();
  });
});
