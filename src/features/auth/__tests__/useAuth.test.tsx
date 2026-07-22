// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { AuthContext, type AuthState } from '../AuthContext';
import { useAuth } from '../useAuth';

const fakeUser = { uid: 'u-1', email: 'test@example.com' } as FirebaseUser;

function wrapperFor(state: AuthState) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
  };
}

describe('useAuth', () => {
  it('returns the authenticated user', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: wrapperFor({ user: fakeUser, loading: false }),
    });

    expect(result.current.user.uid).toBe('u-1');
  });

  // Хук — контракт «здесь пользователь точно есть»: он вызывается только внутри
  // AuthenticatedApp. Молчаливый возврат null дал бы запросы в Firestore с uid === undefined.
  it('throws while auth state is still loading', () => {
    expect(() =>
      renderHook(() => useAuth(), { wrapper: wrapperFor({ user: null, loading: true }) }),
    ).toThrow(/AuthProvider/);
  });

  it('throws when there is no authenticated user', () => {
    expect(() =>
      renderHook(() => useAuth(), { wrapper: wrapperFor({ user: null, loading: false }) }),
    ).toThrow(/AuthProvider/);
  });

  it('throws outside of AuthProvider (context default)', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
