import { createContext, useContext } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';

export type AuthState = {
  user: FirebaseUser | null;
  loading: boolean;
};

export const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
});

export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}
