import { createContext, useContext, useEffect, useState, useCallback, createElement } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Hidden Mode (a.k.a. Stealth Mode) ───────────────────────────────────────
// When enabled, every monetary value across the app is replaced with MASK so a
// driver can open the app in public without exposing earnings. Counts (entries,
// orders, miles, hours, percentages) stay visible. Persisted in AsyncStorage so
// the setting survives restarts.

// Exported so non-React modules (e.g. the notification scheduler, which runs
// outside the provider tree) can read the persisted Hidden Mode state directly.
export const HIDDEN_MODE_KEY = 'hidden_mode';
const STORAGE_KEY = HIDDEN_MODE_KEY;

// Mask shown in place of any dollar value when Hidden Mode is on.
export const MASK = '•••';

interface HiddenModeContextValue {
  hidden: boolean;
  setHidden: (v: boolean) => void;
  toggle: () => void;
}

const HiddenModeContext = createContext<HiddenModeContextValue>({
  hidden: false,
  setHidden: () => {},
  toggle: () => {},
});

export function HiddenModeProvider({ children }: { children: ReactNode }) {
  // Default to masked (true) until the stored value hydrates. This avoids a
  // first-frame leak where a previously-hidden user briefly sees real dollar
  // amounts on cold start before AsyncStorage resolves. The brief mask flash
  // for non-hidden users is the privacy-safe tradeoff for a stealth feature.
  const [hidden, setHiddenState] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        // Any stored value other than '1' (including null/unset) means visible.
        setHiddenState(v === '1');
      })
      .catch(() => {
        // On read failure, fall back to visible so the app stays usable.
        setHiddenState(false);
      });
  }, []);

  const persist = (v: boolean) => {
    AsyncStorage.setItem(STORAGE_KEY, v ? '1' : '0').catch(() => {});
  };

  const setHidden = useCallback((v: boolean) => {
    setHiddenState(v);
    persist(v);
  }, []);

  const toggle = useCallback(() => {
    setHiddenState((prev) => {
      const next = !prev;
      persist(next);
      return next;
    });
  }, []);

  return createElement(
    HiddenModeContext.Provider,
    { value: { hidden, setHidden, toggle } },
    children,
  );
}

export function useHiddenMode(): HiddenModeContextValue {
  return useContext(HiddenModeContext);
}
