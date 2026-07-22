// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
});
