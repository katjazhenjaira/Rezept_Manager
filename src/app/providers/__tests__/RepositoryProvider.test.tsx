// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

// Firestore-реализации импортируют инициализированный SDK — в тестах он не нужен,
// проверяется только сборка набора репозиториев и его мемоизация по uid.
vi.mock('@/infrastructure/firebaseApp', () => ({ db: {}, storage: {}, auth: {} }));

import { RepositoryProvider } from '../RepositoryProvider';
import { useRepositories, type Repositories } from '../RepositoryContext';
import { FirestoreRecipesRepository } from '@/infrastructure/firestore/FirestoreRecipesRepository';
import { FirestoreProgramsRepository } from '@/infrastructure/firestore/FirestoreProgramsRepository';

function wrapperFor(uid: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <RepositoryProvider uid={uid}>{children}</RepositoryProvider>;
  };
}

describe('RepositoryProvider', () => {
  it('provides all six Firestore repositories', () => {
    const { result } = renderHook(() => useRepositories(), { wrapper: wrapperFor('u-1') });

    expect(Object.keys(result.current).sort()).toEqual([
      'cart',
      'nutritionPlan',
      'planner',
      'programs',
      'recipes',
      'userProfile',
    ]);
    expect(result.current.recipes).toBeInstanceOf(FirestoreRecipesRepository);
    expect(result.current.programs).toBeInstanceOf(FirestoreProgramsRepository);
  });

  it('keeps repository identity stable across re-renders with the same uid', () => {
    const { result, rerender } = renderHook(() => useRepositories(), {
      wrapper: wrapperFor('u-1'),
    });
    const first = result.current;

    rerender();

    // Нестабильная ссылка пересоздавала бы подписки DataProvider на каждый рендер.
    expect(result.current).toBe(first);
  });

  it('rebuilds repositories when the uid changes', () => {
    const seen: Repositories[] = [];
    function Probe() {
      seen.push(useRepositories());
      return null;
    }

    const { rerender } = render(
      <RepositoryProvider uid="u-1">
        <Probe />
      </RepositoryProvider>,
    );
    rerender(
      <RepositoryProvider uid="u-2">
        <Probe />
      </RepositoryProvider>,
    );

    // Смена пользователя обязана дать новые репозитории: иначе данные читались бы
    // из коллекций предыдущего uid.
    expect(seen).toHaveLength(2);
    expect(seen[1]).not.toBe(seen[0]);
  });
});
