import { useAuthContext } from './AuthContext';
import type { User as FirebaseUser } from 'firebase/auth';

export function useAuth(): { user: FirebaseUser } {
  const { user, loading } = useAuthContext();
  if (loading || !user) {
    throw new Error('useAuth must be used inside AuthProvider with an authenticated user');
  }
  return { user };
}
