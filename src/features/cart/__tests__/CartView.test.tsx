// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RepositoryContext } from '@/app/providers/RepositoryContext';
import { FakeRecipesRepository } from '@/infrastructure/testing/FakeRecipesRepository';
import { FakePlannerRepository } from '@/infrastructure/testing/FakePlannerRepository';
import { FakeCartRepository } from '@/infrastructure/testing/FakeCartRepository';
import { FakeProgramsRepository } from '@/infrastructure/testing/FakeProgramsRepository';
import { FakeUserProfileRepository } from '@/infrastructure/testing/FakeUserProfileRepository';
import { FakeNutritionPlanRepository } from '@/infrastructure/testing/FakeNutritionPlanRepository';
import type { CartItem } from '@/shared/domain/types';
import { CartView } from '../CartView';

const item: CartItem = {
  id: 'c1',
  name: 'Молоко',
  amount: '1 л',
  sourceDishes: [],
  checked: false,
  isBasic: false,
  createdAt: '2024-01-01',
};

function makeRepos() {
  return {
    recipes: new FakeRecipesRepository(),
    planner: new FakePlannerRepository(),
    cart: new FakeCartRepository(),
    programs: new FakeProgramsRepository(),
    userProfile: new FakeUserProfileRepository(),
    nutritionPlan: new FakeNutritionPlanRepository(),
  };
}

function Wrapper({
  children,
  repos,
}: {
  children: ReactNode;
  repos: ReturnType<typeof makeRepos>;
}) {
  return <RepositoryContext.Provider value={repos}>{children}</RepositoryContext.Provider>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CartView', () => {
  it('shows the empty-state message when the cart is empty', () => {
    const repos = makeRepos();
    render(
      <Wrapper repos={repos}>
        <CartView cart={[]} allergies={[]} />
      </Wrapper>,
    );

    expect(
      screen.getByText('Ваша корзина пуста. Добавьте продукты вручную или из планировщика.'),
    ).toBeInTheDocument();
  });

  it('renders an item and fires the toggle callback through the cart repository', () => {
    const repos = makeRepos();
    const updateSpy = vi.spyOn(repos.cart, 'update');
    render(
      <Wrapper repos={repos}>
        <CartView cart={[item]} allergies={[]} />
      </Wrapper>,
    );

    expect(screen.getByText('Молоко')).toBeInTheDocument();

    const row = screen.getByText('Молоко').closest('.group') as HTMLElement;
    const toggleButton = within(row).getAllByRole('button')[0]!;
    fireEvent.click(toggleButton);

    expect(updateSpy).toHaveBeenCalledWith('c1', { checked: true });
  });

  describe('when the cart repository rejects', () => {
    function renderWithItem() {
      const repos = makeRepos();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      render(
        <Wrapper repos={repos}>
          <CartView cart={[item]} allergies={[]} />
        </Wrapper>,
      );
      const row = screen.getByText('Молоко').closest('.group') as HTMLElement;
      return { repos, alertSpy, buttons: within(row).getAllByRole('button') };
    }

    it('reports a failed toggle instead of dropping the rejection', async () => {
      const { repos, alertSpy, buttons } = renderWithItem();
      vi.spyOn(repos.cart, 'update').mockRejectedValue(new Error('firestore offline'));

      fireEvent.click(buttons[0]!);

      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Ошибка при обновлении корзины'));
    });

    it('reports a failed amount update', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('2 л');
      const { repos, alertSpy, buttons } = renderWithItem();
      vi.spyOn(repos.cart, 'update').mockRejectedValue(new Error('firestore offline'));

      fireEvent.click(buttons[1]!);

      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Ошибка при обновлении корзины'));
    });

    it('reports a failed delete', async () => {
      const { repos, alertSpy, buttons } = renderWithItem();
      vi.spyOn(repos.cart, 'delete').mockRejectedValue(new Error('firestore offline'));

      fireEvent.click(buttons[2]!);

      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Ошибка при удалении из корзины'));
    });

    it('reports a failed clear-all', async () => {
      const repos = makeRepos();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(repos.cart, 'deleteAll').mockRejectedValue(new Error('firestore offline'));
      render(
        <Wrapper repos={repos}>
          <CartView cart={[item]} allergies={[]} />
        </Wrapper>,
      );

      fireEvent.click(screen.getByText('Очистить все'));

      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Ошибка при очистке корзины'));
    });

    it('reports a failed manual add and keeps the entered values', async () => {
      const repos = makeRepos();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(repos.cart, 'add').mockRejectedValue(new Error('firestore offline'));
      render(
        <Wrapper repos={repos}>
          <CartView cart={[]} allergies={[]} />
        </Wrapper>,
      );

      const nameInput = screen.getByPlaceholderText('Название продукта...');
      fireEvent.change(nameInput, { target: { value: 'Хлеб' } });
      fireEvent.click(screen.getByRole('button', { name: /Добавить/ }));

      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Ошибка при добавлении в корзину'));
      // Поле не очищается: пользователь не должен заново набирать текст после сбоя.
      expect(nameInput).toHaveValue('Хлеб');
    });
  });
});
