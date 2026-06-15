import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Oil Change Alert ────────────────────────────────────────────────────────
// Reminds the driver to change their oil after every OIL_CHANGE_INTERVAL miles
// of CUMULATIVE driving. We persist a "baseline" = the all-time mileage reading
// captured at the last reset (0 if never reset). The alert is due once
// (totalMiles - baseline) >= the interval. Resetting re-captures the current
// all-time mileage as the new baseline, so the next reminder is due after
// another full interval — i.e. it fires every interval, cumulatively.
//
// NOTE: the prompt title said "3k" but the task body specifies "every 5,000
// miles (cumulative)" — following the explicit body value.
export const OIL_CHANGE_INTERVAL = 5000;
const BASELINE_KEY = 'oil_change_baseline_miles';

export interface OilChangeState {
  loaded: boolean;        // baseline has hydrated from storage
  due: boolean;           // an oil change is currently due
  milesSince: number;     // miles driven since the last oil change
  milesUntilNext: number; // miles remaining until the next reminder (0 when due)
  totalMiles: number;     // all-time miles passed in
  reset: () => void;      // mark "just changed" → re-baseline to current total
}

/**
 * Drives the Oil Change reminder from an all-time cumulative `totalMiles`.
 * Persists only a small baseline number in AsyncStorage so the milestone
 * survives restarts; the live total comes from the (server-backed) rollup.
 */
export function useOilChange(totalMiles: number): OilChangeState {
  const [baseline, setBaseline] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(BASELINE_KEY)
      .then((v) => {
        const n = v != null ? parseFloat(v) : NaN;
        setBaseline(Number.isFinite(n) ? n : 0);
      })
      .catch(() => setBaseline(0))
      .finally(() => setLoaded(true));
  }, []);

  const reset = useCallback(() => {
    const next = Math.max(0, totalMiles);
    setBaseline(next);
    AsyncStorage.setItem(BASELINE_KEY, String(next)).catch(() => {});
  }, [totalMiles]);

  // Clamp to 0 so deleting entries after a reset (total dipping below the
  // baseline) can't produce a negative "miles since".
  const milesSince = Math.max(0, totalMiles - baseline);
  const due = loaded && milesSince >= OIL_CHANGE_INTERVAL;
  const milesUntilNext = Math.max(0, OIL_CHANGE_INTERVAL - milesSince);

  return { loaded, due, milesSince, milesUntilNext, totalMiles, reset };
}
