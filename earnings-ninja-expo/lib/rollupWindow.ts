import type { QueryClient } from '@tanstack/react-query';
import { estTodayUTC } from './estRange';
import type { Rollup, EntryCreate } from './api';

// Pure, testable helpers behind the dashboard's "new entry shows instantly"
// optimistic cache patching. Extracted from app/(tabs)/index.tsx so the
// window-scoping math can be unit-tested against a real QueryClient (mirrors the
// lib/goalOptimistic.ts pattern). See .agents/memory/optimistic-rollup-window-scoping.md.

// YYYY-MM-DD from a UTC Date (the project buckets all days in US/Eastern, with
// the EST calendar day stored as a UTC-midnight Date).
export function fmtUTCDate(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

// Does the cached query window described by `key` actually contain the EST
// calendar date `estDate` (YYYY-MM-DD)? Used to scope optimistic patches so a new
// entry only ticks the windows that genuinely include it.
//
// Recognized key shapes (all prefixed with a namespace like 'rollup'/'entries'):
//   ['*', 'custom', from, to]        — explicit inclusive EST range
//   ['*', tf, 'nav', from, to]       — swiped/navigated inclusive EST range
//   ['*', label, offset?]            — a named timeframe at an integer day offset
//
// `base` is "today" in EST (UTC-midnight). It defaults to the live EST today so
// production callers are unchanged; tests inject a fixed base for determinism.
export function keyWindowContainsDate(
  key: readonly unknown[],
  estDate: string,
  base: Date = estTodayUTC(),
): boolean {
  if (!Array.isArray(key) || key.length < 2) return true;
  // ['*', 'custom', from, to]
  if (key[1] === 'custom') {
    const from = key[2] as string | undefined;
    const to = key[3] as string | undefined;
    if (!from || !to) return true;
    return estDate >= from && estDate <= to;
  }
  // ['*', tf, 'nav', from, to]
  if (key[2] === 'nav') {
    const from = key[3] as string | undefined;
    const to = key[4] as string | undefined;
    if (!from || !to) return true;
    return estDate >= from && estDate <= to;
  }
  // ['*', label, offset]
  const label = key[1];
  const offset = typeof key[2] === 'number' ? (key[2] as number) : 0;
  const [ey, em, ed] = estDate.split('-').map(Number);
  if (!ey || !em || !ed) return true;
  const entryUTC = Date.UTC(ey, em - 1, ed);
  const dayAt = (n: number) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + n);
    return d;
  };
  switch (label) {
    case 'TODAY':     return fmtUTCDate(dayAt(offset)) === estDate;
    case 'YESTERDAY': return fmtUTCDate(dayAt(-1)) === estDate;
    case 'THIS_WEEK': {
      const dow = (base.getUTCDay() + 6) % 7; // 0 = Monday
      const mon = dayAt(-dow);
      return entryUTC >= mon.getTime() && entryUTC <= base.getTime();
    }
    case 'LAST_7_DAYS': {
      const start = dayAt(-6);
      return entryUTC >= start.getTime() && entryUTC <= base.getTime();
    }
    case 'THIS_MONTH':
      return ey === base.getUTCFullYear() && em - 1 === base.getUTCMonth() && entryUTC <= base.getTime();
    case 'LAST_MONTH': {
      const first = Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1);
      const last = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 0);
      return entryUTC >= first && entryUTC <= last;
    }
    default:
      return true; // unknown window → keep (persisted entries get reconciled anyway)
  }
}

type CreateRollupVars = Pick<EntryCreate, 'type' | 'amount' | 'distance_miles' | 'duration_minutes'>;

// Optimistically apply a brand-new entry to EVERY cached ['rollup', ...] window
// whose date range contains the entry's EST date. Adding the entry's magnitude to
// a containing window's totals is correct regardless of which day inside that
// window it falls on, so this is right for today AND backdated/navigated-window
// creates — the gap that previously left KPI cards stale until an app restart.
// Returns the pre-patch snapshot for an exact onError rollback.
export function applyOptimisticCreateRollup(
  qc: QueryClient,
  vars: CreateRollupVars,
  estDate: string,
  base: Date = estTodayUTC(),
): Array<[readonly unknown[], Rollup | undefined]> {
  const prevRollup = qc.getQueriesData<Rollup>({ queryKey: ['rollup'] });
  const isExpense = vars.type === 'EXPENSE';
  const amt = Math.abs(vars.amount || 0);
  const addMiles = vars.distance_miles || 0;
  const addHours = (vars.duration_minutes || 0) / 60;
  for (const [key, old] of prevRollup) {
    if (!old || !keyWindowContainsDate(key as unknown[], estDate, base)) continue;
    const revenue  = isExpense ? old.revenue  : old.revenue  + amt;
    const expenses = isExpense ? old.expenses + amt : old.expenses;
    const profit   = revenue - expenses;
    const miles    = old.miles + addMiles;
    const hours    = old.hours + addHours;
    qc.setQueryData(key, {
      ...old,
      revenue,
      expenses,
      profit,
      miles,
      hours,
      dollars_per_mile: miles > 0 ? profit / miles : 0,
      goal_progress: old.goal?.target_profit
        ? profit / old.goal.target_profit
        : old.goal_progress ?? null,
    });
  }
  return prevRollup;
}
