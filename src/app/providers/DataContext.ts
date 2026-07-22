import { createContext, useContext } from 'react';
import type { Recipe, PlannerEntry, CartItem, Program } from '@/shared/domain/types';

/** Ключи коллекций, на которые подписан DataProvider. */
export type DataCollectionKey = 'recipes' | 'plannerEntries' | 'cartItems' | 'programs';

export type DataState = {
  recipes: Recipe[];
  plannerEntries: PlannerEntry[];
  cartItems: CartItem[];
  programs: Program[];
  /**
   * Коллекции, подписка на которые упала (отзыв прав, истёкший токен).
   * Без этого пустой массив данных неотличим от «данных нет» — см. LOG-9.
   * Поле опционально, чтобы потребители `useData()` не ломались.
   */
  errors?: DataCollectionKey[];
};

export const DataContext = createContext<DataState>({
  recipes: [],
  plannerEntries: [],
  cartItems: [],
  programs: [],
  errors: [],
});

export function useData(): DataState {
  return useContext(DataContext);
}
