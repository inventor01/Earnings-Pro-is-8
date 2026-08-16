// Per-account timezone for ALL day/week/month bucketing on the client.
//
// The account's IANA zone lives on the server (auth_users.timezone) and is the
// single source of truth; this module mirrors it so every local computation
// (estRange, chartBuckets, localStore, demoStore, csvExport, CalendarModal)
// buckets days in exactly the same zone as the server — online AND offline.
//
// Sync contract:
//  - signup sends the device zone; the server stores it.
//  - login / getMe returns the account zone → setUserTz() mirrors it here.
//  - the settings row PATCHes the server first, then setUserTz().
//  - DEFAULT matches the server's grandfather backfill (America/New_York), so
//    before the first successful sync the client agrees with the server for
//    every pre-existing account.
//
// The mirror is account-scoped: clearUserTz() must be called from the logout
// wipe (see .agents/memory/account-scoped-mirror-wipe.md).

import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_TZ = 'America/New_York';
const STORE_KEY = 'user_tz_v1';

let currentTz: string = DEFAULT_TZ;

export function getUserTz(): string {
  return currentTz;
}

// True if `tz` resolves in this JS engine's Intl data.
export function isValidTz(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// The device's current IANA zone (falls back to DEFAULT_TZ if undetectable).
export function deviceTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isValidTz(tz) ? tz : DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

// Set the in-memory zone (and mirror it) — call with the SERVER's value after
// login/getMe or a successful settings change. Invalid zones are ignored so a
// bad server value can never break local math.
export function setUserTz(tz: string): void {
  if (!isValidTz(tz)) return;
  currentTz = tz;
  AsyncStorage.setItem(STORE_KEY, tz).catch(() => {});
}

// Restore the mirrored zone on cold start (before any query renders) so
// offline launches bucket days in the account zone, not the default.
export async function loadUserTz(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (raw && isValidTz(raw)) currentTz = raw;
  } catch {}
  return currentTz;
}

// Logout wipe — the next account must not inherit this one's zone.
export async function clearUserTz(): Promise<void> {
  currentTz = DEFAULT_TZ;
  try {
    await AsyncStorage.removeItem(STORE_KEY);
  } catch {}
}
