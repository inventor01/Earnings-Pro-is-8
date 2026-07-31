// Eastern-time-aware chart bucketing for the dashboard ProfitChart and the
// Analytics aggregations.
//
// WHY THIS FILE EXISTS ("ProfitChart timezone mismatch"): every KPI/rollup
// boundary in the app is computed in US/Eastern (mirroring the backend's EST
// day windows — see lib/estRange.ts), but the charts used to bucket entries by
// the DEVICE's local time (d.getHours(), d.getDate(), ...). For any user whose
// phone isn't set to Eastern time, a bar could land in a different hour — or a
// different day entirely, near midnight — than the EST-based totals shown
// right above it. All hour/day/weekday extraction for charts must go through
// the helpers below, never through the native local-time Date getters.

import { parseUTC, estTodayUTC } from './estRange';

export type ChartBucket = { key: string; sum: number; label: string };

type ChartEntry = { timestamp: string | Date; amount: number | string };
type ChartPeriod = 'today' | 'yesterday' | 'week' | 'last7' | 'month' | 'lastMonth' | 'custom';
type CustomRange = { from: string; to: string };

// Shared formatter — hourCycle h23 so hours come back 0-23.
const EAST = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
});

// { y, m (1-12), d, h (0-23) } of the given instant in US/Eastern.
export function easternParts(at: Date): { y: number; m: number; d: number; h: number } {
  const map: Record<string, string> = {};
  for (const p of EAST.formatToParts(at)) map[p.type] = p.value;
  return { y: Number(map.year), m: Number(map.month), d: Number(map.day), h: Number(map.hour) % 24 };
}

// Hour of day (0-23) in US/Eastern.
export function easternHourOfDay(at: Date): number {
  return easternParts(at).h;
}

// 'YYYY-MM-DD' calendar-day key in US/Eastern.
export function easternDayKey(at: Date): string {
  const { y, m, d } = easternParts(at);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Day of week (0=Sun..6=Sat) in US/Eastern.
export function easternWeekday(at: Date): number {
  const { y, m, d } = easternParts(at);
  // Date.UTC of the eastern calendar date gives the correct weekday via getUTCDay.
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Single-day views render hourly; a custom range covering exactly one calendar
// day counts as single-day too (otherwise it renders as ONE full-width bar).
export function isHourlyPeriod(period: ChartPeriod, customRange?: CustomRange | null): boolean {
  return period === 'today' || period === 'yesterday' ||
    (period === 'custom' && !!customRange && customRange.from === customRange.to);
}

// 24 hourly buckets (12am..11pm), summing signed amounts by Eastern hour.
export function buildHourlyBuckets(entries: ChartEntry[]): ChartBucket[] {
  const arr: ChartBucket[] = Array.from({ length: 24 }, (_, h) => ({
    key: String(h), sum: 0,
    label: `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`,
  }));
  for (const e of entries) {
    const h = easternHourOfDay(parseUTC(e.timestamp));
    if (h >= 0 && h < 24) arr[h].sum += Number(e.amount) || 0;
  }
  return arr;
}

// Ascending 'YYYY-MM-DD' Eastern day keys, `days` long, ending on `endUTC`
// (a UTC-anchored calendar date like estTodayUTC()).
function dayKeysEndingOn(endUTC: Date, days: number): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endUTC);
    d.setUTCDate(endUTC.getUTCDate() - i);
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);
  }
  return keys;
}

// Resolve the multi-day span for a period: how many days and the UTC-anchored
// end calendar date, all in Eastern terms. Capped at 31 buckets for legibility.
export function dailySpan(period: ChartPeriod, customRange?: CustomRange | null): { days: number; endUTC: Date } {
  let days = 7;
  let endUTC = estTodayUTC();
  if (period === 'month') {
    days = endUTC.getUTCDate(); // days elapsed this Eastern month
  } else if (period === 'lastMonth') {
    // Last day of the previous Eastern month.
    endUTC = new Date(Date.UTC(endUTC.getUTCFullYear(), endUTC.getUTCMonth(), 0));
    days = endUTC.getUTCDate();
  } else if (period === 'custom' && customRange) {
    // EST date strings 'YYYY-MM-DD' — count inclusive.
    const [fy, fm, fd] = customRange.from.split('-').map(Number);
    const [ty, tm, td] = customRange.to.split('-').map(Number);
    const fromMs = Date.UTC(fy, fm - 1, fd);
    endUTC = new Date(Date.UTC(ty, tm - 1, td));
    days = Math.max(1, Math.round((endUTC.getTime() - fromMs) / 86400000) + 1);
  }
  return { days: Math.min(days, 31), endUTC };
}

// Daily buckets for multi-day ranges, keyed and bucketed by Eastern day.
export function buildDailyBuckets(
  entries: ChartEntry[],
  period: ChartPeriod,
  customRange?: CustomRange | null,
): ChartBucket[] {
  const { days, endUTC } = dailySpan(period, customRange);
  const arr: ChartBucket[] = dayKeysEndingOn(endUTC, days).map(key => {
    const [, m, d] = key.split('-').map(Number);
    return { key, sum: 0, label: `${m}/${d}` };
  });
  const indexByKey = new Map(arr.map((b, i) => [b.key, i]));
  for (const e of entries) {
    const idx = indexByKey.get(easternDayKey(parseUTC(e.timestamp)));
    if (idx !== undefined) arr[idx].sum += Number(e.amount) || 0;
  }
  return arr;
}
