import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Shell } from './app/layout/Shell';
import { RepositoryProvider } from './app/providers/RepositoryProvider';
import { DataProvider } from './app/providers/DataProvider';
import { UserProfileProvider } from './app/providers/UserProfileProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RepositoryProvider>
      <DataProvider>
        <UserProfileProvider>
          <Shell>
            <App />
          </Shell>
        </UserProfileProvider>
      </DataProvider>
    </RepositoryProvider>
  </StrictMode>,
);
