import { createContext, useContext } from 'react';
import type { Recipe, PlannerEntry, CartItem, Program } from '@/shared/domain/types';

export type DataState = {
  recipes: Recipe[];
  plannerEntries: PlannerEntry[];
  cartItems: CartItem[];
  programs: Program[];
};

export const DataContext = createContext<DataState>({
  recipes: [],
  plannerEntries: [],
  cartItems: [],
  programs: [],
});

export function useData(): DataState {
  return useContext(DataContext);
}
