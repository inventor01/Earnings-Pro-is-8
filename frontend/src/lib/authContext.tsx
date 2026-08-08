import React, { createContext, useState, useContext, useEffect } from 'react';
import { QueryClient } from '@tanstack/react-query';

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // SECURITY: auth tokens live in sessionStorage (per-tab, cleared on close),
  // NOT localStorage, to limit exposure of the bearer JWT to XSS persistence.
  // Load token from sessionStorage on mount.
  useEffect(() => {
    // One-time cleanup: purge any token persisted by older builds.
    localStorage.removeItem('auth_token');
    const savedToken = sessionStorage.getItem('auth_token');
    if (savedToken) {
      setToken(savedToken);
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string) => {
    // Clear React Query cache when switching users to prevent data leakage
    queryClient.clear();
    setToken(newToken);
    sessionStorage.setItem('auth_token', newToken);
    // Flag to play intro sound on first login (sessionStorage expires on page refresh)
    sessionStorage.setItem('justLoggedIn', 'true');
  };

  const logout = () => {
    // Clear React Query cache when logging out to prevent data leakage
    queryClient.clear();
    setToken(null);
    sessionStorage.removeItem('auth_token');
  };

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
