// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CartItem } from '@/shared/domain/types';
import { CartItemRow } from '../CartItemRow';

const item: CartItem = {
  id: 'c1',
  name: 'Молоко',
  amount: '1 л',
  sourceDishes: ['Каша'],
  checked: false,
  isBasic: false,
  createdAt: '2024-01-01',
};

function renderRow(overrides: Partial<React.ComponentProps<typeof CartItemRow>> = {}) {
  const props = {
    item,
    allergens: [] as string[],
    onToggle: vi.fn(),
    onDelete: vi.fn(),
    onUpdateAmount: vi.fn(),
    ...overrides,
  };
  render(<CartItemRow {...props} />);
  return props;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CartItemRow', () => {
  it('renders the name, amount and source dishes', () => {
    renderRow();

    expect(screen.getByText('Молоко')).toBeInTheDocument();
    expect(screen.getByText('1 л')).toBeInTheDocument();
    expect(screen.getByText('(Каша)')).toBeInTheDocument();
  });

  it('prefixes the amount and shows the staple hint for basic items', () => {
    renderRow({ isBasic: true });

    expect(screen.getByText('Нужно: 1 л')).toBeInTheDocument();
    expect(screen.getByText('Есть в наличии или докупить?')).toBeInTheDocument();
  });

  it('warns about allergens for an unchecked item', () => {
    renderRow({ allergens: ['молоко'] });

    expect(screen.getByText(/Осторожно: аллерген!/)).toBeInTheDocument();
    expect(screen.getByText(/молоко/)).toBeInTheDocument();
  });

  it('hides the allergen warning once the item is checked', () => {
    renderRow({ item: { ...item, checked: true }, allergens: ['молоко'] });

    expect(screen.queryByText(/Осторожно: аллерген!/)).not.toBeInTheDocument();
  });

  it('fires onToggle with the item when the checkbox is clicked', () => {
    const { onToggle } = renderRow();

    fireEvent.click(screen.getAllByRole('button')[0]!);

    expect(onToggle).toHaveBeenCalledWith(item);
  });

  it('fires onDelete with the item id when the delete button is clicked', () => {
    const { onDelete } = renderRow();

    // Порядок кнопок: [0] чекбокс, [1] изменить количество, [2] удалить.
    fireEvent.click(screen.getAllByRole('button')[2]!);

    expect(onDelete).toHaveBeenCalledWith('c1');
  });

  it('fires onUpdateAmount with the value entered in the prompt', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('2 л');
    const { onUpdateAmount } = renderRow();

    fireEvent.click(screen.getAllByRole('button')[1]!);

    expect(onUpdateAmount).toHaveBeenCalledWith('c1', '2 л');
  });

  it('does not fire onUpdateAmount when the prompt is cancelled', () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    const { onUpdateAmount } = renderRow();

    fireEvent.click(screen.getAllByRole('button')[1]!);

    expect(onUpdateAmount).not.toHaveBeenCalled();
  });

  it('does not render the amount-edit button for basic items', () => {
    renderRow({ isBasic: true });

    // Остаются только чекбокс и удаление — правка количества у базовых продуктов не предусмотрена.
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
