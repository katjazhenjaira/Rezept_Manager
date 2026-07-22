// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataContext, type DataState } from '@/app/providers/DataContext';
import { DataErrorBanner } from '../DataErrorBanner';

function renderWithData(state: Partial<DataState>) {
  const value: DataState = {
    recipes: [],
    plannerEntries: [],
    cartItems: [],
    programs: [],
    ...state,
  };
  return render(
    <DataContext.Provider value={value}>
      <DataErrorBanner />
    </DataContext.Provider>,
  );
}

describe('DataErrorBanner', () => {
  it('renders nothing when there are no subscription errors', () => {
    const { container } = render(
      <DataContext.Provider
        value={{ recipes: [], plannerEntries: [], cartItems: [], programs: [] }}
      >
        <DataErrorBanner />
      </DataContext.Provider>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('warns that data failed to load, naming the affected sections', () => {
    renderWithData({ errors: ['recipes', 'cartItems'] });

    const banner = screen.getByRole('alert');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('Рецепты');
    expect(banner.textContent).toContain('Корзина');
    expect(banner.textContent).not.toContain('Планер');
  });
});
