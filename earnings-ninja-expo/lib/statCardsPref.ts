import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDemoActive, subscribeDemo } from './demoSession';

// ─── Driving stat cards visibility ($/Mile + Miles row) ──────────────────────
// The user can long-press the row on the dashboard to hide it COMPLETELY (not
// just mask the numbers) and bring it back via Settings → Privacy. Module-level
// state with subscribers so the dashboard row and the Settings switch (separate
// components) stay in sync without prop drilling.
//
// Per-account hygiene: the mirror is cleared on logout via clearStatCardsPref()
// (wired into authContext.clearAllLocalData), so the next account on this
// device never inherits the previous account's hidden row.
// Demo Mode: changes are session-only (never persisted) and the real
// preference is re-hydrated when the demo ends.

const STORAGE_KEY = 'stat_cards_hidden_v1';

let hiddenState = false;
const listeners = new Set<(v: boolean) => void>();

// Bumped on every explicit set/clear. A hydration read only applies its result
// if no explicit write happened while the (async) read was in flight —
// otherwise a slow AsyncStorage.getItem could resurrect a stale value right
// after the user hid the row or logged out.
let writeGen = 0;

function emit(): void {
  listeners.forEach((l) => l(hiddenState));
}

async function hydrate(): Promise<void> {
  const gen = writeGen;
  let v: string | null = null;
  try {
    v = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    v = null;
  }
  if (gen !== writeGen) return; // an explicit write won the race
  hiddenState = v === '1';
  emit();
}

// Kick off initial hydration at module load (matches hiddenMode's pattern of
// reading persisted prefs early; default false = cards visible).
void hydrate();

// Re-hydrate around demo transitions so sandbox toggling evaporates.
subscribeDemo(() => {
  if (isDemoActive()) return; // keep whatever is showing when demo starts
  void hydrate();
});

export function getStatCardsHidden(): boolean {
  return hiddenState;
}

export function setStatCardsHidden(v: boolean): void {
  writeGen++;
  hiddenState = v;
  if (!isDemoActive()) {
    AsyncStorage.setItem(STORAGE_KEY, v ? '1' : '0').catch(() => {});
  }
  emit();
}

// Logout wipe: reset to visible and remove the stored flag.
export async function clearStatCardsPref(): Promise<void> {
  writeGen++;
  hiddenState = false;
  emit();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function useStatCardsHidden(): [boolean, (v: boolean) => void] {
  const [hidden, setLocal] = useState(hiddenState);
  useEffect(() => {
    const l = (v: boolean) => setLocal(v);
    listeners.add(l);
    // Sync in case state changed between render and effect.
    setLocal(hiddenState);
    return () => { listeners.delete(l); };
  }, []);
  return [hidden, setStatCardsHidden];
}
