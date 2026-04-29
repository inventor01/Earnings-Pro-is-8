import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, User } from './api';

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
    AsyncStorage.getItem('auth_token').then(async (t) => {
      if (t) {
        setToken(t);
        try {
          const u = await api.getMe();
          setUser(u);
        } catch {
          await AsyncStorage.removeItem('auth_token');
          setToken(null);
        }
      }
      setIsLoading(false);
    });
  }, []);

  const login = async (newToken: string) => {
    await AsyncStorage.setItem('auth_token', newToken);
    setToken(newToken);
    try {
      const u = await api.getMe();
      setUser(u);
    } catch {}
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
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
