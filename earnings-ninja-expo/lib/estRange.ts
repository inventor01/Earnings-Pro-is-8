// User-timezone date-range math for LOCAL (offline) rollup/entries computation.
// Mirrors backend/services/period.py so locally-computed windows line up exactly
// with the server's day/week/month boundaries in the ACCOUNT's timezone (see
// lib/userTz — defaults to America/New_York until synced, matching the server's
// grandfather backfill). Function names keep their historical 'est' prefix.
//
// All ranges are returned as absolute UTC millisecond bounds [fromMs, toMs] so
// they can be compared directly against an entry's parsed UTC timestamp.

import type { TimeframeType } from './api';
import { getUserTz } from './userTz';

// Parse a server timestamp to a correct UTC instant. FastAPI serializes naive
// UTC without a trailing 'Z', which JS would misread as device-local — append
// 'Z' when there's no tz designator. (Duplicated from api.parseServerDate to
// keep localStore free of a runtime import cycle with api.)
export function parseUTC(ts: string | Date): Date {
  if (ts instanceof Date) return ts;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(ts)) return new Date(ts);
  return new Date(ts + 'Z');
}

// Offset (ms) of the user's timezone from UTC at the given instant (negative
// west of Greenwich). Uses Intl so DST is handled automatically. Formatters are
// cached per zone — creating one per call is expensive on RN.
const offsetFmtCache = new Map<string, Intl.DateTimeFormat>();
function offsetFmt(tz: string): Intl.DateTimeFormat {
  let f = offsetFmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    offsetFmtCache.set(tz, f);
  }
  return f;
}
function tzOffsetMs(at: Date): number {
  const dtf = offsetFmt(getUserTz());
  const parts = dtf.formatToParts(at);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    Number(map.hour), Number(map.minute), Number(map.second),
  );
  return asUTC - at.getTime();
}

// Convert a user-local wall-clock time (y, m=1-12, d, hh, mm, ss, ms) to the
// absolute UTC instant (ms). Two-pass so the offset is resolved at the actual
// instant (correct across DST transitions, except the rare ambiguous fall-back
// hour which never affects day-boundary midnights).
export function estWallToUTCms(
  y: number, m: number, d: number,
  hh = 0, mm = 0, ss = 0, ms = 0,
): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss, ms);
  const off1 = tzOffsetMs(new Date(guess));
  let utc = guess - off1;
  const off2 = tzOffsetMs(new Date(utc));
  if (off2 !== off1) utc = guess - off2;
  return utc;
}

// Today's calendar date in the user's timezone as a UTC-anchored Date.
// ── DateTimePicker bridge ─────────────────────────────────────────────────────
// The native picker can only edit a DEVICE-LOCAL Date. When the account zone
// differs from the device zone, the wall-clock the picker shows must be the
// ACCOUNT-zone wall-clock of the instant, or a traveling user picks "9:00 AM"
// and the entry files under a different time. These two helpers convert a real
// UTC instant ↔ a "shifted" device-local Date whose local fields equal the
// account-zone wall-clock. Always round-trip through them around the picker;
// the shifted Date is display-only and must never be saved directly.
export function instantToPickerDate(instant: Date): Date {
  const dtf = offsetFmt(getUserTz());
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  return new Date(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    Number(map.hour), Number(map.minute), Number(map.second),
  );
}
export function pickerDateToInstant(picked: Date): Date {
  return new Date(estWallToUTCms(
    picked.getFullYear(), picked.getMonth() + 1, picked.getDate(),
    picked.getHours(), picked.getMinutes(), picked.getSeconds(),
  ));
}

export function estTodayUTC(): Date {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: getUserTz() });
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function ymd(dt: Date): { y: number; m: number; d: number } {
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

// [fromMs, toMs] UTC bounds for an EST calendar date range (inclusive),
// from 00:00:00.000 of `from` to 23:59:59.999 of `to`.
function boundsFor(
  from: { y: number; m: number; d: number },
  to: { y: number; m: number; d: number },
): { fromMs: number; toMs: number } {
  return {
    fromMs: estWallToUTCms(from.y, from.m, from.d, 0, 0, 0, 0),
    toMs: estWallToUTCms(to.y, to.m, to.d, 23, 59, 59, 999),
  };
}

// Parse a 'YYYY-MM-DD' (or leading-date ISO) string to {y,m,d}.
function parseYMD(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

// EST bounds for an explicit from/to date range (used by *InRange APIs).
export function rangeForDates(fromIso: string, toIso: string): { fromMs: number; toMs: number } | null {
  const from = parseYMD(fromIso);
  const to = parseYMD(toIso);
  if (!from || !to) return null;
  return boundsFor(from, to);
}

// EST bounds for a named timeframe + day offset (used by getRollup/getEntries).
// Matches keyWindowContainsDate / backend period.py exactly.
export function rangeForTimeframe(timeframe: string, dayOffset = 0): { fromMs: number; toMs: number } {
  const base = estTodayUTC();
  const dayAt = (n: number) => {
    const dt = new Date(base);
    dt.setUTCDate(base.getUTCDate() + n);
    return dt;
  };
  const tf = timeframe as TimeframeType;
  switch (tf) {
    case 'TODAY': {
      const day = ymd(dayAt(dayOffset));
      return boundsFor(day, day);
    }
    case 'YESTERDAY': {
      const day = ymd(dayAt(-1));
      return boundsFor(day, day);
    }
    case 'THIS_WEEK': {
      const dow = (base.getUTCDay() + 6) % 7; // 0 = Monday
      const mon = ymd(dayAt(-dow));
      return boundsFor(mon, ymd(base));
    }
    case 'LAST_7_DAYS': {
      return boundsFor(ymd(dayAt(-6)), ymd(base));
    }
    case 'THIS_MONTH': {
      const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
      return boundsFor(ymd(first), ymd(base));
    }
    case 'LAST_MONTH': {
      const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 0));
      return boundsFor(ymd(first), ymd(last));
    }
    default: {
      // Unknown timeframe → today (safe default).
      const day = ymd(base);
      return boundsFor(day, day);
    }
  }
}

// EST calendar date string (YYYY-MM-DD) for today + `offset` days. This is the
// canonical key for per-date daily goals: computed from the EST clock, so a
// device timezone change can never shift which date's goal is read or written.
export function estDateIsoForOffset(offset = 0): string {
  const base = estTodayUTC();
  base.setUTCDate(base.getUTCDate() + offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${base.getUTCFullYear()}-${p(base.getUTCMonth() + 1)}-${p(base.getUTCDate())}`;
}
