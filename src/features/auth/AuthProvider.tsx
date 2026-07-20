import { useState, useEffect, type ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/infrastructure/firebaseAuth';
import { AuthContext } from './AuthContext';
import { LandingPage } from './LandingPage';
import { LoginScreen } from './LoginScreen';
import { SignupScreen } from './SignupScreen';

type AuthScreen = 'landing' | 'login' | 'signup';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<AuthScreen>('landing');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) setScreen('landing');
    });
  }, []);

  if (loading) {
    return (
      <AuthContext.Provider value={{ user: null, loading: true }}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
        {children}
      </AuthContext.Provider>
    );
  }

  if (!user) {
    if (screen === 'login') {
      return (
        <LoginScreen onGoToSignup={() => setScreen('signup')} onBack={() => setScreen('landing')} />
      );
    }
    if (screen === 'signup') {
      return (
        <SignupScreen onGoToLogin={() => setScreen('login')} onBack={() => setScreen('landing')} />
      );
    }
    return (
      <LandingPage
        onGoToLogin={() => setScreen('login')}
        onGoToSignup={() => setScreen('signup')}
      />
    );
  }

  return <AuthContext.Provider value={{ user, loading: false }}>{children}</AuthContext.Provider>;
}
