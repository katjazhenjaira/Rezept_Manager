// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecipeSelectionBar } from '../RecipeSelectionBar';

describe('RecipeSelectionBar', () => {
  it('renders nothing while selection mode is off', () => {
    render(
      <RecipeSelectionBar
        isVisible={false}
        selectedCount={3}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByText('Добавить')).not.toBeInTheDocument();
  });

  it('shows the number of selected recipes', () => {
    render(
      <RecipeSelectionBar isVisible selectedCount={3} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.getByText('3 рецептов')).toBeInTheDocument();
  });

  it('disables confirmation while nothing is selected', () => {
    render(
      <RecipeSelectionBar isVisible selectedCount={0} onCancel={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /добавить/i })).toBeDisabled();
  });

  it('fires onConfirm and onCancel', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    render(
      <RecipeSelectionBar isVisible selectedCount={2} onCancel={onCancel} onConfirm={onConfirm} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /добавить/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /отмена/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
