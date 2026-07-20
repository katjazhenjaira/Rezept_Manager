// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { User as FirebaseUser } from 'firebase/auth';
import { AuthProvider } from '../AuthProvider';
import { useAuthContext } from '../AuthContext';

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
}));
vi.mock('@/infrastructure/firebaseAuth', () => ({
  auth: {},
}));

import { onAuthStateChanged } from 'firebase/auth';

function AuthStateDisplay() {
  const { user, loading } = useAuthContext();
  if (loading) return <div>loading</div>;
  if (!user) return <div>no-user</div>;
  return <div>user:{user.uid}</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders loading spinner before onAuthStateChanged fires', () => {
    (onAuthStateChanged as Mock).mockImplementation(() => () => {});
    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>,
    );
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('renders LandingPage (no-user branch) when Firebase returns null', async () => {
    (onAuthStateChanged as Mock).mockImplementation((_auth: unknown, cb: (u: null) => void) => {
      cb(null);
      return () => {};
    });
    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>,
    );
    // AuthProvider intercepts no-user and shows LandingPage, not children
    expect(screen.queryByText('no-user')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
  });

  it('renders children when Firebase returns a user', async () => {
    const fakeUser = { uid: 'abc123' } as FirebaseUser;
    (onAuthStateChanged as Mock).mockImplementation(
      (_auth: unknown, cb: (u: FirebaseUser) => void) => {
        cb(fakeUser);
        return () => {};
      },
    );
    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>,
    );
    expect(screen.getByText('user:abc123')).toBeInTheDocument();
  });

  it('returns to LandingPage after logout', async () => {
    let authCallback: (u: FirebaseUser | null) => void = () => {};
    (onAuthStateChanged as Mock).mockImplementation(
      (_auth: unknown, cb: (u: FirebaseUser | null) => void) => {
        authCallback = cb;
        cb({ uid: 'abc123' } as FirebaseUser);
        return () => {};
      },
    );
    render(
      <AuthProvider>
        <AuthStateDisplay />
      </AuthProvider>,
    );
    expect(screen.getByText('user:abc123')).toBeInTheDocument();

    act(() => authCallback(null));
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
  });
});
