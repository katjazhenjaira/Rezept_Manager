// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { RecipesEmptyState } from '../RecipesEmptyState';

function renderEmptyState(overrides: Partial<Parameters<typeof RecipesEmptyState>[0]> = {}) {
  const props = {
    photoInputRef: createRef<HTMLInputElement>(),
    onAddPDF: vi.fn(),
    onAddLink: vi.fn(),
    onAddManual: vi.fn(),
    ...overrides,
  };
  render(<RecipesEmptyState {...props} />);
  return props;
}

describe('RecipesEmptyState', () => {
  it('offers all four ways to add the first recipe', () => {
    renderEmptyState();

    expect(screen.getByText('Твой банк рецептов пока пуст')).toBeInTheDocument();
    expect(screen.getByText('Фото рецепта')).toBeInTheDocument();
    expect(screen.getByText('PDF документ')).toBeInTheDocument();
    expect(screen.getByText('Вставить ссылку')).toBeInTheDocument();
    expect(screen.getByText('Добавить вручную')).toBeInTheDocument();
  });

  it('fires the matching callback for each action', () => {
    const props = renderEmptyState();

    fireEvent.click(screen.getByText('PDF документ'));
    expect(props.onAddPDF).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Вставить ссылку'));
    expect(props.onAddLink).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Добавить вручную'));
    expect(props.onAddManual).toHaveBeenCalledTimes(1);
  });

  it('opens the hidden file input for the photo action', () => {
    const input = document.createElement('input');
    input.type = 'file';
    const click = vi.spyOn(input, 'click');
    renderEmptyState({ photoInputRef: { current: input } });

    fireEvent.click(screen.getByText('Фото рецепта'));

    expect(click).toHaveBeenCalledTimes(1);
  });
});
