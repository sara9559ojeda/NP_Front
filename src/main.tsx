import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppRoutes } from './App';
import { AuthProvider } from './auth/AuthContext';
import './styles/global.css';

async function start() {
  // The simulated server runs only when asked for (default in development). See README.
  const useMocks = (import.meta.env.VITE_USE_MOCKS ?? (import.meta.env.DEV ? 'true' : 'false')) === 'true';
  if (useMocks) {
    const { startMockServer } = await import('./mocks/browser');
    await startMockServer();
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

void start();
