import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Shell } from './app/layout/Shell';
import { I18nProvider } from './app/providers/I18nProvider';
import { RepositoryProvider } from './app/providers/RepositoryProvider';
import { DataProvider } from './app/providers/DataProvider';
import { UserProfileProvider } from './app/providers/UserProfileProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <RepositoryProvider>
        <DataProvider>
          <UserProfileProvider>
            <Shell>
              <App />
            </Shell>
          </UserProfileProvider>
        </DataProvider>
      </RepositoryProvider>
    </I18nProvider>
  </StrictMode>,
);
