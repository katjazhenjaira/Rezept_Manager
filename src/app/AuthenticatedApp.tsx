import App from '@/App';
import { Shell } from '@/app/layout/Shell';
import { I18nProvider } from '@/app/providers/I18nProvider';
import { RepositoryProvider } from '@/app/providers/RepositoryProvider';
import { DataProvider } from '@/app/providers/DataProvider';
import { UserProfileProvider } from '@/app/providers/UserProfileProvider';
import { useAuthContext } from '@/features/auth/AuthContext';

export function AuthenticatedApp() {
  const { user, loading } = useAuthContext();
  if (loading || !user) return null;
  return (
    <I18nProvider>
      <RepositoryProvider uid={user.uid}>
        <DataProvider>
          <UserProfileProvider>
            <Shell>
              <App />
            </Shell>
          </UserProfileProvider>
        </DataProvider>
      </RepositoryProvider>
    </I18nProvider>
  );
}
