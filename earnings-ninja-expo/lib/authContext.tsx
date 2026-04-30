import { createContext, useContext, useEffect, useState } from 'react';
import { api, User } from './api';
import { getToken, setToken as persistToken, clearToken } from './tokenStorage';

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
        try {
          const u = await api.getMe();
          setUser(u);
        } catch {
          await clearToken();
          setToken(null);
        }
      }
      setIsLoading(false);
    });
  }, []);

  const login = async (newToken: string) => {
    await persistToken(newToken);
    setToken(newToken);
    try {
      const u = await api.getMe();
      setUser(u);
    } catch {}
  };

  const logout = async () => {
    await clearToken();
    setToken(null);
    setUser(null);
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
