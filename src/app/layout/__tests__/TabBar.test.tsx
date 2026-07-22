// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
// Side-effect import: initializes the global i18next instance (ru resources),
// mirroring what AuthenticatedApp does via I18nProvider in the real app.
import '@/app/providers/i18nConfig';
import { TabBar } from '../TabBar';

describe('TabBar', () => {
  it('renders all tab labels', () => {
    render(<TabBar activeTab="recipes" onTabChange={vi.fn()} />);

    expect(screen.getByText('Рецепты')).toBeInTheDocument();
    expect(screen.getByText('Планер')).toBeInTheDocument();
    expect(screen.getByText('Корзина')).toBeInTheDocument();
    expect(screen.getByText('Трекер')).toBeInTheDocument();
    expect(screen.getByText('Программы')).toBeInTheDocument();
  });

  it('fires onTabChange with the clicked tab id', () => {
    const onTabChange = vi.fn();
    render(<TabBar activeTab="recipes" onTabChange={onTabChange} />);

    fireEvent.click(screen.getByText('Планер'));
    expect(onTabChange).toHaveBeenCalledWith('planner');
  });
});
