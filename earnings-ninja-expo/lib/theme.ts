import { createContext, useContext, useEffect, useState, useCallback, createElement } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { widgetSync } from './widgetSync';

// Two themes only: 'dark' (default, the neon Car-Dashboard look) and 'light'
// (clean white background that keeps the exact brand neon accents + glows).
export type ThemeName = 'dark' | 'light';

export interface Theme {
  name: ThemeName;
  label: string;
  isDark: boolean;
  BG: string;
  SURFACE: string;
  CARD_BG: string;
  CARD: string;
  BORDER: string;
  PRIMARY: string;      // neon brand accent — fills, glows, borders, active states
  PRIMARY_TXT: string;  // accent used as FOREGROUND text/icons (readable on the BG)
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

// ── Dark (default) — true-black with neon glow ──────────────────────────────
export const dark: Theme = {
  name: 'dark',
  label: 'Dark',
  isDark: true,
  BG: '#0a0a0a',
  SURFACE: '#111111',
  CARD_BG: '#1a1a1a',
  CARD: '#1a1a1a',
  BORDER: '#262626',
  PRIMARY: '#facc15',
  PRIMARY_TXT: '#facc15',   // neon yellow is perfectly readable on black
  ACCENT: '#facc15',
  PRI_LITE: '#2a2410',
  PRI_DARK: '#ca8a04',
  TEXT: '#f1f5f9',
  TEXT_MID: '#cbd5e1',
  MUTED: '#94a3b8',
  // HIG contrast: #64748b on the dark surface fell below WCAG AA for small
  // text; #7d8ba3 keeps the muted look while staying readable.
  LABEL: '#7d8ba3',
  DIM: '#64748b',
  GREEN: '#22c55e',
  GREEN_LT: '#052e16',
  RED: '#ef4444',
  RED_LT: '#450a0a',
  DIVIDER: '#1f1f1f',
  ON_PRIMARY: '#000000',
};

// ── Light — clean white with the SAME brand neon accents/glows ──────────────
// PRIMARY stays neon yellow (#facc15) so fills, glows, progress bars, borders
// and active states keep the exact brand pop. Because neon yellow is unreadable
// as text on white, PRIMARY_TXT switches to black (brand rule: accents are
// strictly black or #facc15 — no brown/gold). GREEN keeps the brand #22c55e.
export const light: Theme = {
  name: 'light',
  label: 'Light',
  isDark: false,
  BG: '#f8fafc',
  SURFACE: '#ffffff',
  CARD_BG: '#ffffff',
  CARD: '#ffffff',
  BORDER: '#e2e8f0',
  PRIMARY: '#facc15',
  PRIMARY_TXT: '#000000',
  ACCENT: '#facc15',
  PRI_LITE: '#fef9c3',
  PRI_DARK: '#ca8a04',
  TEXT: '#0f172a',
  TEXT_MID: '#334155',
  MUTED: '#64748b',
  LABEL: '#94a3b8',
  DIM: '#94a3b8',
  GREEN: '#22c55e',
  GREEN_LT: '#dcfce7',
  RED: '#ef4444',
  RED_LT: '#fee2e2',
  DIVIDER: '#e8edf2',
  ON_PRIMARY: '#000000',
};

export const THEMES: Record<ThemeName, Theme> = {
  dark,
  light,
};

const STORAGE_KEY = 'theme_name';

// Map any persisted value (incl. legacy 3-theme names) to a current ThemeName.
function normalizeThemeName(v: string | null | undefined): ThemeName {
  if (v === 'light' || v === 'simpleLight') return 'light';
  // 'dark', 'darkNeon', 'bwNeon', null, or anything unknown -> dark (default)
  return 'dark';
}

interface ThemeContextValue {
  theme: Theme;
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: dark,
  themeName: 'dark',
  setThemeName: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        const normalized = normalizeThemeName(v);
        setThemeNameState(normalized);
        // Rewrite legacy / unknown values so storage stays canonical.
        if (v !== normalized) {
          AsyncStorage.setItem(STORAGE_KEY, normalized).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // Keep the iOS Home Screen widget's appearance in sync with the app theme.
  useEffect(() => {
    widgetSync.pushTheme(themeName);
  }, [themeName]);

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
