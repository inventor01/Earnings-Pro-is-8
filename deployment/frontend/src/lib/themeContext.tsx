import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeName, getTheme, THEMES } from './themes';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (name: ThemeName) => void;
  config: ReturnType<typeof getTheme>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('theme') as ThemeName | null;
    return (saved && saved in THEMES) ? saved : 'dark-neon';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (name: ThemeName) => {
    setThemeState(name);
  };

  const value = {
    theme,
    setTheme,
    config: getTheme(theme),
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
