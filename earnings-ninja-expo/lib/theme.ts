import { createContext, useContext, useEffect, useState, useCallback, useRef, createElement } from 'react';
import type { ReactNode } from 'react';
import { Appearance, Animated, StyleSheet, AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { widgetSync } from './widgetSync';

// Two rendered themes: 'dark' (the neon Car-Dashboard look) and 'light'
// (clean white background that keeps the exact brand neon accents + glows).
export type ThemeName = 'dark' | 'light';
// What the user PICKS in Settings. 'system' follows the device appearance
// live (no restart) via the native Appearance API.
export type ThemePreference = ThemeName | 'system';

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

// Map any persisted value (incl. legacy 3-theme names) to a ThemePreference.
function normalizePreference(v: string | null | undefined): ThemePreference {
  if (v === 'system') return 'system';
  // Users who explicitly picked a dark look keep it.
  if (v === 'dark' || v === 'darkNeon' || v === 'bwNeon') return 'dark';
  // Everything else — 'light', legacy 'simpleLight', null (fresh install),
  // or unknown — starts on the white/light theme (the default).
  return 'light';
}

function resolve(pref: ThemePreference, system: ThemeName): ThemeName {
  return pref === 'system' ? system : pref;
}

interface ThemeContextValue {
  theme: Theme;
  /** The RESOLVED theme actually rendered ('light' | 'dark'). */
  themeName: ThemeName;
  /** The user's saved choice ('light' | 'dark' | 'system'). */
  themePreference: ThemePreference;
  /** Persist a new preference. */
  setThemeName: (name: ThemePreference) => void;
  /** Temporary, non-persisted override (walkthrough demo). null = clear. */
  setThemeOverride: (name: ThemeName | null) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: light,
  themeName: 'light',
  themePreference: 'light',
  setThemeName: () => {},
  setThemeOverride: () => {},
});

/** Full-screen fade that softens theme switches: the OLD background color
 * fades out over the new theme (~350ms). Skipped under Reduce Motion. */
function ThemeFade({ resolved }: { resolved: ThemeName }) {
  const prevRef = useRef(resolved);
  const opacity = useRef(new Animated.Value(0)).current;
  const [fadeColor, setFadeColor] = useState<string | null>(null);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { reduceMotionRef.current = v; }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotionRef.current = v;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (prevRef.current === resolved) return;
    const oldBg = THEMES[prevRef.current].BG;
    prevRef.current = resolved;
    if (reduceMotionRef.current) return; // instant switch, no interpolation
    setFadeColor(oldBg);
    opacity.setValue(1);
    Animated.timing(opacity, {
      toValue: 0, duration: 350, useNativeDriver: true,
    }).start(() => setFadeColor(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);

  if (!fadeColor) return null;
  return createElement(Animated.View, {
    pointerEvents: 'none',
    style: [StyleSheet.absoluteFillObject, { backgroundColor: fadeColor, opacity, zIndex: 99999 }],
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Light is the launch default; the stored preference (if any) loads in the
  // effect below before the first frame settles.
  const [preference, setPreferenceState] = useState<ThemePreference>('light');
  const [systemScheme, setSystemScheme] = useState<ThemeName>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );
  // Walkthrough demo override — never persisted, never survives a restart.
  const [override, setOverride] = useState<ThemeName | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        const normalized = normalizePreference(v);
        setPreferenceState(normalized);
        // Rewrite legacy / unknown values so storage stays canonical.
        if (v !== normalized) {
          AsyncStorage.setItem(STORAGE_KEY, normalized).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // Follow the DEVICE appearance live. Cheap to keep always-subscribed; it
  // only re-renders when the OS scheme actually flips, and it makes
  // switching preference→'system' reflect the current device state instantly.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  const resolved: ThemeName = override ?? resolve(preference, systemScheme);

  // Keep the iOS Home Screen widget's appearance in sync with the app theme.
  useEffect(() => {
    widgetSync.pushTheme(resolved);
  }, [resolved]);

  const setThemeName = useCallback((name: ThemePreference) => {
    setPreferenceState(name);
    AsyncStorage.setItem(STORAGE_KEY, name).catch(() => {});
  }, []);

  const setThemeOverride = useCallback((name: ThemeName | null) => {
    setOverride(name);
  }, []);

  return createElement(
    ThemeContext.Provider,
    {
      value: {
        theme: THEMES[resolved],
        themeName: resolved,
        themePreference: preference,
        setThemeName,
        setThemeOverride,
      },
    },
    children,
    createElement(ThemeFade, { key: 'theme-fade', resolved }),
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeControls(): {
  themeName: ThemeName;
  themePreference: ThemePreference;
  setThemeName: (n: ThemePreference) => void;
  setThemeOverride: (n: ThemeName | null) => void;
} {
  const { themeName, themePreference, setThemeName, setThemeOverride } = useContext(ThemeContext);
  return { themeName, themePreference, setThemeName, setThemeOverride };
}
