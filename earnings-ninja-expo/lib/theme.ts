import { createContext, useContext, useEffect, useState, useCallback, createElement } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeName = 'darkNeon' | 'simpleLight' | 'bwNeon';

export interface Theme {
  name: ThemeName;
  label: string;
  isDark: boolean;
  BG: string;
  SURFACE: string;
  CARD_BG: string;
  CARD: string;
  BORDER: string;
  PRIMARY: string;
  ACCENT: string;
  PRI_LITE: string;
  PRI_DARK: string;
  TEXT: string;
  TEXT_MID: string;
  MUTED: string;
  LABEL: string;
  DIM: string;
  GREEN: string;
  GREEN_LT: string;
  RED: string;
  RED_LT: string;
  DIVIDER: string;
  ON_PRIMARY: string;
}

export const darkNeon: Theme = {
  name: 'darkNeon',
  label: 'Dark Neon',
  isDark: true,
  BG: '#0a0a0a',
  SURFACE: '#111111',
  CARD_BG: '#1a1a1a',
  CARD: '#1a1a1a',
  BORDER: '#262626',
  PRIMARY: '#facc15',
  ACCENT: '#facc15',
  PRI_LITE: '#2a2410',
  PRI_DARK: '#ca8a04',
  TEXT: '#f1f5f9',
  TEXT_MID: '#cbd5e1',
  MUTED: '#94a3b8',
  LABEL: '#64748b',
  DIM: '#64748b',
  GREEN: '#22c55e',
  GREEN_LT: '#052e16',
  RED: '#ef4444',
  RED_LT: '#450a0a',
  DIVIDER: '#1f1f1f',
  ON_PRIMARY: '#000000',
};

export const simpleLight: Theme = {
  name: 'simpleLight',
  label: 'Simple Light',
  isDark: false,
  BG: '#f8fafc',
  SURFACE: '#ffffff',
  CARD_BG: '#f1f5f9',
  CARD: '#f1f5f9',
  BORDER: '#e2e8f0',
  PRIMARY: '#2563eb',
  ACCENT: '#2563eb',
  PRI_LITE: '#dbeafe',
  PRI_DARK: '#1d4ed8',
  TEXT: '#0f172a',
  TEXT_MID: '#334155',
  MUTED: '#64748b',
  LABEL: '#94a3b8',
  DIM: '#94a3b8',
  GREEN: '#16a34a',
  GREEN_LT: '#dcfce7',
  RED: '#dc2626',
  RED_LT: '#fee2e2',
  DIVIDER: '#e2e8f0',
  ON_PRIMARY: '#ffffff',
};

export const bwNeon: Theme = {
  name: 'bwNeon',
  label: 'B/W Neon',
  isDark: true,
  BG: '#000000',
  SURFACE: '#0a0a0a',
  CARD_BG: '#141414',
  CARD: '#141414',
  BORDER: '#2a2a2a',
  PRIMARY: '#ffffff',
  ACCENT: '#ffffff',
  PRI_LITE: '#1f1f1f',
  PRI_DARK: '#d4d4d4',
  TEXT: '#ffffff',
  TEXT_MID: '#e5e5e5',
  MUTED: '#a3a3a3',
  LABEL: '#737373',
  DIM: '#737373',
  GREEN: '#ffffff',
  GREEN_LT: '#1f1f1f',
  RED: '#737373',
  RED_LT: '#1f1f1f',
  DIVIDER: '#1f1f1f',
  ON_PRIMARY: '#000000',
};

export const THEMES: Record<ThemeName, Theme> = {
  darkNeon,
  simpleLight,
  bwNeon,
};

const STORAGE_KEY = 'theme_name';

interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkNeon,
  themeName: 'darkNeon',
  setThemeName: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>('darkNeon');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v && (v === 'darkNeon' || v === 'simpleLight' || v === 'bwNeon')) {
          setThemeNameState(v as ThemeName);
        }
      })
      .catch(() => {});
  }, []);

  const setThemeName = useCallback((name: ThemeName) => {
    setThemeNameState(name);
    AsyncStorage.setItem(STORAGE_KEY, name).catch(() => {});
  }, []);

  return createElement(
    ThemeContext.Provider,
    { value: { theme: THEMES[themeName], themeName, setThemeName } },
    children,
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeControls(): { themeName: ThemeName; setThemeName: (n: ThemeName) => void } {
  const { themeName, setThemeName } = useContext(ThemeContext);
  return { themeName, setThemeName };
}
