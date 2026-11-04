import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { refreshAccessToken, setAccessToken, setSessionLostHandler } from '../api/client';
import { auth as authApi, me as meApi } from '../api/endpoints';
import type { Me, Role } from '../api/types';

type Status = 'loading' | 'anonymous' | 'authenticated';

interface AuthState {
  status: Status;
  user: Me | null;
  /** True when the session ended on its own (expired refresh), to tell the user. */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  /** Drops the local session without calling the API (e.g. after withdrawing consent). */
  clearSession: () => void;
  setUser: (user: Me) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export const HOME_BY_ROLE: Record<Role, string> = {
  patient: '/paciente',
  professional: '/profesional',
  admin: '/admin',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUserState] = useState<Me | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUserState(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => {
      setSessionExpired(true);
      clearSession();
    });
    let cancelled = false;
    // Restore the session after a reload through the refresh cookie (§2.2).
    (async () => {
      const ok = await refreshAccessToken();
      if (!ok) {
        if (!cancelled) setStatus('anonymous');
        return;
      }
      try {
        const current = await meApi.get();
        if (!cancelled) {
          setUserState(current);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) clearSession();
      }
    })();
    return () => {
      cancelled = true;
      setSessionLostHandler(null);
    };
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login({ email, password });
    setAccessToken(result.accessToken);
    const current = await meApi.get();
    setUserState(current);
    setSessionExpired(false);
    setStatus('authenticated');
    return current;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthState>(
    () => ({ status, user, sessionExpired, login, logout, clearSession, setUser: setUserState }),
    [status, user, sessionExpired, login, logout, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
