import type { ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { AuthContext } from '@/features/auth/AuthContext';

type Props = {
  uid: string | null;
  children: ReactNode;
};

export function FakeAuthProvider({ uid, children }: Props) {
  // Минимальный фейк — заполнены только uid/email; если код прочитает другое поле FirebaseUser (displayName, getIdToken и т.п.), скомпилируется, но упадёт в рантайме.
  const user = uid ? ({ uid, email: 'test@test.com' } as unknown as FirebaseUser) : null;

  return <AuthContext.Provider value={{ user, loading: false }}>{children}</AuthContext.Provider>;
}
