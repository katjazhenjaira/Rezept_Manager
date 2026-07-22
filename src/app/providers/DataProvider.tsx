import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { Recipe, PlannerEntry, CartItem, Program } from '@/shared/domain/types';
import { DataContext, type DataCollectionKey } from './DataContext';
import { useRepositories } from './RepositoryContext';

const COLLECTION_ORDER: DataCollectionKey[] = [
  'recipes',
  'plannerEntries',
  'cartItems',
  'programs',
];

type FailureMap = Record<DataCollectionKey, boolean>;

const NO_FAILURES: FailureMap = {
  recipes: false,
  plannerEntries: false,
  cartItems: false,
  programs: false,
};

export function DataProvider({ children }: { children: ReactNode }) {
  const {
    recipes: recipesRepo,
    planner: plannerRepo,
    cart: cartRepo,
    programs: programsRepo,
  } = useRepositories();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plannerEntries, setPlannerEntries] = useState<PlannerEntry[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [failures, setFailures] = useState<FailureMap>(NO_FAILURES);

  const markFailure = useCallback((key: DataCollectionKey, failed: boolean) => {
    setFailures((prev) => (prev[key] === failed ? prev : { ...prev, [key]: failed }));
  }, []);

  useEffect(
    () =>
      recipesRepo.subscribeAll(
        (items) => {
          setRecipes(items);
          markFailure('recipes', false);
        },
        () => markFailure('recipes', true),
      ),
    [recipesRepo, markFailure],
  );

  useEffect(
    () =>
      plannerRepo.subscribeAll(
        (items) => {
          setPlannerEntries(items);
          markFailure('plannerEntries', false);
        },
        () => markFailure('plannerEntries', true),
      ),
    [plannerRepo, markFailure],
  );

  useEffect(
    () =>
      cartRepo.subscribeAll(
        (items) => {
          setCartItems(items);
          markFailure('cartItems', false);
        },
        () => markFailure('cartItems', true),
      ),
    [cartRepo, markFailure],
  );

  useEffect(
    () =>
      programsRepo.subscribeAll(
        (items) => {
          setPrograms(items);
          markFailure('programs', false);
        },
        () => markFailure('programs', true),
      ),
    [programsRepo, markFailure],
  );

  const errors = useMemo(() => COLLECTION_ORDER.filter((key) => failures[key]), [failures]);

  const value = useMemo(
    () => ({ recipes, plannerEntries, cartItems, programs, errors }),
    [recipes, plannerEntries, cartItems, programs, errors],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
