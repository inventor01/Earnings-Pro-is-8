import { createContext, useContext, useEffect, useState } from 'react';
import { api, User } from './api';
import { getToken, setToken as persistToken, clearToken } from './tokenStorage';
import { widgetSync } from './widgetSync';

interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getToken().then(async (t) => {
      if (t) {
        setToken(t);
        // Re-push token to the iOS widget on cold-start. Without this the
        // widget only ever sees a token at explicit login(), so after an
        // app kill its quick-add tiles fall back to "Sign in" even though
        // SecureStore still has a valid token.
        widgetSync.onLogin(t);
        try {
          const u = await api.getMe();
          setUser(u);
        } catch (err: any) {
          // Only force-logout if the server *explicitly* rejected the token
          // (401/403). On a transient network error, keep the token so the
          // next refetch can succeed — punishing the user for a flaky tunnel
          // means they have to re-log every time they open the app offline.
          const msg = String(err?.message ?? '');
          const isAuthFailure = /401|403|unauthor/i.test(msg);
          if (isAuthFailure) {
            await clearToken();
            setToken(null);
            widgetSync.onLogout();
          }
        }
      }
      setIsLoading(false);
    });
  }, []);

  const login = async (newToken: string) => {
    await persistToken(newToken);
    setToken(newToken);
    widgetSync.onLogin(newToken);
    try {
      const u = await api.getMe();
      setUser(u);
    } catch {}
  };

  const logout = async () => {
    await clearToken();
    setToken(null);
    setUser(null);
    widgetSync.onLogout();
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
