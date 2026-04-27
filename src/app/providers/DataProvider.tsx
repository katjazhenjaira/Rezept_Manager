import { useState, useEffect, type ReactNode } from 'react';
import type { Recipe, PlannerEntry, CartItem, Program } from '@/shared/domain/types';
import { DataContext } from './DataContext';
import { useRepositories } from './RepositoryContext';

export function DataProvider({ children }: { children: ReactNode }) {
  const { recipes: recipesRepo, planner: plannerRepo, cart: cartRepo, programs: programsRepo } = useRepositories();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plannerEntries, setPlannerEntries] = useState<PlannerEntry[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => recipesRepo.subscribeAll(setRecipes), [recipesRepo]);
  useEffect(() => plannerRepo.subscribeAll(setPlannerEntries), [plannerRepo]);
  useEffect(() => cartRepo.subscribeAll(setCartItems), [cartRepo]);
  useEffect(() => programsRepo.subscribeAll(setPrograms), [programsRepo]);

  return (
    <DataContext.Provider value={{ recipes, plannerEntries, cartItems, programs }}>
      {children}
    </DataContext.Provider>
  );
}
