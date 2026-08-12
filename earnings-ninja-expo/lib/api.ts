import Constants from 'expo-constants';
import { getToken } from './tokenStorage';
import { reportSuccess, reportFailure } from './connectivity';
import { refreshPendingCount } from './pendingCount';
import { requestDrain } from './syncTrigger';
import {
  localRollupForTimeframe,
  localRollupForRange,
  localEntriesForTimeframe,
  localEntriesForRange,
  mergeServerEntries,
  replaceServerEntries,
  persistGoal,
  getLocalGoal,
  getLocalEntry,
  removeLocalEntries,
  overlayPendingOnEntries,
  overlayPendingOnRollup,
} from './localStore';
import { rangeForTimeframe, rangeForDates } from './estRange';
import { isDemoActive } from './demoSession';
import { demoApi } from './demoApi';

// Priority: EXPO_PUBLIC env var → app.json extra → production fallback.
// Production fallback points at the Railway-hosted backend so the shipped
// iOS build keeps working even if the Replit dev environment is offline.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ||
  (Constants.expoConfig?.extra?.apiBase as string | undefined) ||
  'https://earnings-pro-is-8-production.up.railway.app';

// Legal links — the single source of truth for the whole app. They point at
// the branded production domain (verified live / HTTP 200). NOTE: never use
// earningsninja.APP here — that domain's /privacy 404s and caused an Apple
// rejection. If the .com routing ever breaks, fall back to `${API_BASE}/privacy`
// (the backend renders the same pages).
export const PRIVACY_URL = 'https://earningsninja.com/privacy';
export const TERMS_URL = 'https://earningsninja.com/terms';

async function getAuthToken(): Promise<string | null> {
  return getToken();
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// Single fetch wrapper that feeds the connectivity tracker: ANY response (even
// 4xx/5xx) means the server is reachable → online; a thrown fetch (network
// error) → offline. This is how the app derives connection state without a
// native NetInfo dependency. All api.* calls route through here.
async function trackedFetch(input: string, init?: RequestInit): Promise<Response> {
  // Hard safety net for local sandbox Demo Mode: no request may ever leave the
  // device while a demo session is active (demo calls are served by demoApi via
  // the Proxy below; anything that slips through lands here). Throw BEFORE the
  // try so reportFailure never mislabels the app as offline.
  if (isDemoActive()) {
    throw new Error('Demo Mode is offline — create a free account to use this feature.');
  }
  try {
    const res = await globalThis.fetch(input, init);
    reportSuccess();
    return res;
  } catch (err: any) {
    // Aborted requests (React Query cancelQueries / component unmount) are NOT
    // network failures — flagging them offline made the sync indicator flicker
    // and kicked off pointless connectivity probes.
    if (err?.name !== 'AbortError') reportFailure();
    throw err;
  }
}

export type EntryType = 'ORDER' | 'BONUS' | 'EXPENSE' | 'CANCELLATION';
export type AppType = 'DOORDASH' | 'UBEREATS' | 'INSTACART' | 'GRUBHUB' | 'SHIPT' | 'OTHER';
export type ExpenseCategory = 'GAS' | 'PARKING' | 'TOLLS' | 'MAINTENANCE' | 'PHONE' | 'SUBSCRIPTION' | 'FOOD' | 'LEISURE' | 'CHARITY' | 'OTHER';
export type TimeframeType = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'LAST_MONTH';

export const APP_LABELS: Record<AppType, string> = {
  DOORDASH: 'DoorDash',
  UBEREATS: 'Uber Eats',
  INSTACART: 'Instacart',
  GRUBHUB: 'GrubHub',
  SHIPT: 'Shipt',
  OTHER: 'Other',
};

export const APP_COLORS: Record<AppType, string> = {
  DOORDASH: '#FF3008',
  UBEREATS: '#06C167',
  INSTACART: '#43B02A',
  GRUBHUB: '#F63440',
  SHIPT: '#00A6CE',
  OTHER: '#94a3b8',
};

export const EXPENSE_EMOJIS: Record<ExpenseCategory, string> = {
  GAS: '⛽',
  PARKING: '🅿️',
  TOLLS: '🛣️',
  MAINTENANCE: '🔧',
  PHONE: '📱',
  SUBSCRIPTION: '📦',
  FOOD: '🍔',
  LEISURE: '🎮',
  CHARITY: '🤲',
  OTHER: '📋',
};

// FastAPI serializes naive UTC datetimes without a trailing 'Z', and JS
// `new Date(...)` then treats the string as device-local time — which is
// wrong (the value is actually UTC). This helper appends 'Z' when there is
// no timezone designator so the resulting Date refers to the correct
// moment in time and `toLocaleTimeString()` etc. show the user's local
// equivalent. Pass-through for full ISO strings that already include a TZ.
export function parseServerDate(ts: string | Date): Date {
  if (ts instanceof Date) return ts;
  // Already has Z or +HH:MM / -HH:MM offset after the T? Use as-is.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(ts)) return new Date(ts);
  return new Date(ts + 'Z');
}

export interface Entry {
  id: number;
  timestamp: string;
  type: EntryType;
  app: AppType;
  order_id?: string;
  amount: number;
  distance_miles: number;
  duration_minutes: number;
  category?: ExpenseCategory;
  note?: string;
  receipt_url?: string;
  is_business_expense?: boolean;
  created_at: string;
  updated_at: string;
  // Stable client key echoed back by the server (see EntryCreate.idempotency_key).
  // Lets the offline overlay drop a still-queued create once its real row lands.
  idempotency_key?: string;
  // Display name for entries logged against a user-created platform. When set,
  // `app` is always 'OTHER' — this carries the real identity for display.
  custom_app?: string | null;
  // Display name for entries logged against a user-created earnings type.
  // When set, `type` holds the safe BASE type (BONUS or EXPENSE).
  custom_type?: string | null;
  // Display name for EXPENSE entries filed under a user-created category.
  // When set, `category` holds the safe enum value 'OTHER'.
  custom_category?: string | null;
}

// Generates a stable, highly-unique client key for idempotent creates. Only
// needs uniqueness within one user's data (not crypto strength); the timestamp
// plus two random base36 chunks makes a collision between two distinct creates
// effectively impossible, which matters because a collision would wrongly
// dedupe a real second entry.
function newIdempotencyKey(): string {
  return `ik_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}_${Math.random().toString(36).slice(2, 12)}`;
}

export interface EntryCreate {
  type: EntryType;
  app: AppType;
  amount: number;
  distance_miles?: number;
  duration_minutes?: number;
  category?: ExpenseCategory;
  note?: string;
  date?: string;
  time?: string;
  receipt_url?: string;
  is_business_expense?: boolean;
  // Stable client-generated key for idempotent creates. The SAME key rides the
  // first POST and any offline-queue replay, so if the original request reached
  // the server but the phone saw a timeout, the backend returns the original row
  // instead of inserting a duplicate (see backend create_entry).
  idempotency_key?: string;
  // User-created platform name; sent with app='OTHER' (see Entry.custom_app).
  custom_app?: string | null;
  // User-created earnings type name; sent with a BASE type of BONUS (income
  // customs) or EXPENSE (expense customs) — see Entry.custom_type.
  custom_type?: string | null;
  // User-created expense category name; sent with category='OTHER' — see
  // Entry.custom_category.
  custom_category?: string | null;
}

// A user-created delivery platform (server-persisted, per account).
// `color` (hex '#rrggbb') and `icon` (short emoji) are optional user-chosen
// identity; null/absent means "auto" (stable hash color, no icon).
export interface UserPlatform {
  id: number;
  name: string;
  color?: string | null;
  icon?: string | null;
}

// A user-created earnings type (server-persisted, per account). Entries logged
// against one carry a BASE enum type (BONUS for kind='income', EXPENSE for
// kind='expense') plus custom_type=<name>, so totals and older clients keep
// working. `kind` is fixed at creation.
export interface UserEntryType {
  id: number;
  name: string;
  kind: 'income' | 'expense';
  color?: string | null;
  icon?: string | null;
}

// A user-created expense category (server-persisted, per account). EXPENSE
// entries filed under one carry category='OTHER' plus custom_category=<name>,
// so totals and older clients keep working.
export interface UserExpenseCategory {
  id: number;
  name: string;
  color?: string | null;
  icon?: string | null;
}

// A per-user cosmetic rename of a BUILT-IN Platform or Type pill label.
// The underlying key stored on entries never changes.
export interface LabelOverride {
  kind: 'platform' | 'type';
  key: string;   // e.g. DOORDASH / ORDER
  label: string;
}

export interface Rollup {
  revenue: number;
  expenses: number;
  profit: number;
  miles: number;
  hours: number;
  dollars_per_mile: number;
  average_order_value: number;
  goal?: { target_profit: number; goal_name: string } | null;
  goal_progress?: number | null;
}

export interface Goal {
  id: number;
  timeframe: TimeframeType;
  target_profit: number;
  goal_name: string;
  // Server update timestamp (exposed by GoalResponse). Used as the LWW baseline
  // for offline goal edits; absent on synthetic offline placeholders.
  updated_at?: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  email_verified?: boolean;
  is_demo?: boolean;
  // Server-synced one-time onboarding flag. `false` = fresh signup that still
  // needs the funnel; undefined (old cached profile / older server) is treated
  // as completed so existing users NEVER see onboarding (fail open).
  onboarding_completed?: boolean;
  // Server-synced dashboard-tour flag. `true` = this account has seen the
  // walkthrough on SOME device, so never auto-show it again (survives
  // reinstall). undefined (old cached profile / older server) falls back to
  // the device-local AsyncStorage flag only.
  walkthrough_completed?: boolean;
}

export interface ReferralInfo {
  code: string;
  referred_count: number;
  rewards_earned: number;
  rewards_cap: number;
  rewards_remaining: number;
}

export interface RedeemResponse {
  success: boolean;
  message: string;
  referee_reward_granted: boolean;
}

// /auth/login returns one of two shapes: a normal access token, or — when the
// account has email 2FA enabled — an `mfa_required` challenge that the login
// screen completes with a code via verifyMfa().
export type LoginResult =
  | { access_token: string; mfa_required?: undefined }
  | { mfa_required: true; challenge_token: string; email?: string };

const realApi = {
  async login(credential: string, password: string): Promise<LoginResult> {
    const res = await trackedFetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed');
    }
    // Either an access token, OR — when the account has email 2FA on — an
    // `mfa_required` challenge the caller must complete via verifyMfa().
    return res.json();
  },

  // Exchange an emailed 6-digit code (+ the login challenge token) for an
  // access token. Used by the login screen's 2FA step.
  async verifyMfa(challengeToken: string, code: string): Promise<{ access_token: string }> {
    const res = await trackedFetch(`${API_BASE}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_token: challengeToken, code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not verify code');
    }
    return res.json();
  },

  // Confirm an emailed code that turns 2FA ON (purpose='enable'). Same endpoint
  // as verifyMfa but returns a success flag instead of an access token.
  async confirmMfaEnable(challengeToken: string, code: string): Promise<{ success: boolean }> {
    const res = await trackedFetch(`${API_BASE}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_token: challengeToken, code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not verify code');
    }
    return res.json();
  },

  async resendMfa(challengeToken: string): Promise<{ challenge_token: string; email?: string }> {
    const res = await trackedFetch(`${API_BASE}/api/auth/mfa/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_token: challengeToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not resend code');
    }
    return res.json();
  },

  async getMfaStatus(): Promise<{ enabled: boolean; email?: string }> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/auth/mfa/status`, { headers });
    if (!res.ok) throw new Error(`getMfaStatus failed: ${res.status}`);
    return res.json();
  },

  // Begin enabling 2FA — server emails a confirmation code and returns a
  // challenge the user confirms via confirmMfaEnable().
  async enableMfa(): Promise<{ challenge_token?: string; already_enabled?: boolean; email?: string }> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/auth/mfa/enable`, { method: 'POST', headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not start two-factor setup');
    }
    return res.json();
  },

  async disableMfa(password?: string): Promise<{ success: boolean }> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/auth/mfa/disable`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password ?? null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not turn off two-factor');
    }
    return res.json();
  },

  // Email confirmation (NON-blocking nudge). `needs_verification` drives the
  // dashboard banner; it's false for verified, demo, and no-email accounts.
  async getEmailVerifyStatus(): Promise<{
    email?: string;
    email_verified: boolean;
    needs_verification: boolean;
  }> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/auth/email/status`, { headers });
    if (!res.ok) throw new Error(`getEmailVerifyStatus failed: ${res.status}`);
    return res.json();
  },

  async verifyEmail(code: string): Promise<{ email_verified: boolean; needs_verification: boolean }> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/auth/verify-email`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not confirm your email');
    }
    return res.json();
  },

  async resendEmailVerification(): Promise<{ sent: boolean; needs_verification: boolean }> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/auth/verify-email/resend`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not resend the code');
    }
    return res.json();
  },

  async signup(
    email: string,
    password: string,
    username: string,
    referralCode?: string,
  ): Promise<{ access_token: string }> {
    const body: Record<string, string> = { email, password, username };
    const code = (referralCode || '').trim();
    if (code) body.referral_code = code;
    const res = await trackedFetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Signup failed');
    }
    return res.json();
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const res = await trackedFetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not send reset email');
    }
    return res.json();
  },

  async demo(): Promise<{ access_token: string }> {
    const res = await trackedFetch(`${API_BASE}/api/auth/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to start demo');
    return res.json();
  },

  // Account profile changes. Both throw with the server's human-readable
  // `detail` message so the Settings UI can surface it directly.
  async changeUsername(username: string): Promise<{ success: boolean; username: string }> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/auth/change-username`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not change your username');
    }
    return res.json();
  },

  async changeEmail(email: string, password?: string): Promise<{
    success: boolean;
    email: string;
    needs_verification: boolean;
    access_token: string;
  }> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/auth/change-email`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: password ?? null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not change your email');
    }
    return res.json();
  },

  async getMe(): Promise<User> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/auth/me`, { headers });
    if (!res.ok) {
      // Include HTTP status in the message so authContext can distinguish
      // "server explicitly rejected my token" (401/403 → clear token) from
      // "the network is flaky" (500/0 → keep token, retry later).
      throw new Error(`getMe failed: ${res.status}`);
    }
    return res.json();
  },

  // Mark the one-time conversion onboarding funnel done for this account.
  // Server-synced so a reinstall never re-onboards an existing user.
  // Idempotent; throws on failure so the caller can queue a retry.
  async completeOnboarding(): Promise<{ onboarding_completed: boolean }> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/auth/onboarding/complete`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) throw new Error('Failed to save onboarding status');
    return res.json();
  },

  // Mark the dashboard tutorial walkthrough seen for this account.
  // Server-synced so a reinstall never re-shows the tour. Idempotent;
  // throws on failure so the caller can decide to retry (the device-local
  // flag still guards same-device relaunches meanwhile).
  async completeWalkthrough(): Promise<{ walkthrough_completed: boolean }> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/auth/walkthrough/complete`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) throw new Error('Failed to save walkthrough status');
    return res.json();
  },

  // Referral program. GET /referrals/me lazily mints the caller's code on first
  // read and returns their progress toward the (capped) free-month rewards.
  async getReferralInfo(): Promise<ReferralInfo> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/referrals/me`, { headers });
    if (!res.ok) throw new Error(`getReferralInfo failed: ${res.status}`);
    return res.json();
  },

  // Redeem someone else's referral code (for users who didn't enter one at
  // signup). Backend enforces once-per-user, no self-referral, and the cap.
  async redeemReferral(code: string): Promise<RedeemResponse> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/referrals/redeem`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code: code.trim() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'That referral code is invalid.');
    }
    return res.json();
  },

  // Bulk-import entries (used by the CSV import in Settings). Backend skips
  // any row it can't parse and returns `{ count, message }`.
  async importEntries(entries: EntryCreate[]): Promise<{ count: number; message: string }> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/entries/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify(entries),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`importEntries failed: ${res.status} ${text.slice(0, 200)}`);
    }
    return res.json();
  },

  async getRollup(timeframe: string = 'TODAY', dayOffset: number = 0): Promise<Rollup> {
    const headers = await getAuthHeaders();
    const url = dayOffset !== 0 && timeframe === 'TODAY'
      ? `${API_BASE}/api/rollup?timeframe=${timeframe}&day_offset=${dayOffset}`
      : `${API_BASE}/api/rollup?timeframe=${timeframe}`;
    let res: Response;
    try {
      res = await trackedFetch(url, { headers });
    } catch {
      // Offline → compute the rollup locally so any period works at cold start.
      return localRollupForTimeframe(timeframe, dayOffset);
    }
    if (!res.ok) throw new Error('Failed to fetch rollup');
    const data: Rollup = await res.json();
    // Layer pending offline mutations onto the KPIs so a refetch doesn't snap
    // them back to a server total that excludes a still-queued entry. No-op when
    // nothing is queued.
    const { fromMs, toMs } = rangeForTimeframe(timeframe, dayOffset);
    return overlayPendingOnRollup(data, fromMs, toMs, data.goal ?? null);
  },

  async getRollupInRange(fromIso: string, toIso: string): Promise<Rollup> {
    const headers = await getAuthHeaders();
    const url = `${API_BASE}/api/rollup?from_date=${encodeURIComponent(fromIso)}&to_date=${encodeURIComponent(toIso)}`;
    let res: Response;
    try {
      res = await trackedFetch(url, { headers });
    } catch {
      return localRollupForRange(fromIso, toIso);
    }
    if (!res.ok) throw new Error('Failed to fetch rollup');
    const data: Rollup = await res.json();
    // Layer pending offline mutations onto the KPIs (see getRollup). No-op when
    // the queue is empty; skipped if the range can't be parsed into EST bounds.
    const bounds = rangeForDates(fromIso, toIso);
    if (!bounds) return data;
    return overlayPendingOnRollup(data, bounds.fromMs, bounds.toMs, data.goal ?? null);
  },

  async getEntries(timeframe: string = 'TODAY', limit = 200, dayOffset: number = 0): Promise<Entry[]> {
    const headers = await getAuthHeaders();
    const offsetParam = dayOffset !== 0 && timeframe === 'TODAY' ? `&day_offset=${dayOffset}` : '';
    let res: Response;
    try {
      res = await trackedFetch(`${API_BASE}/api/entries?timeframe=${timeframe}&limit=${limit}${offsetParam}`, { headers });
    } catch {
      return localEntriesForTimeframe(timeframe, limit, dayOffset);
    }
    if (!res.ok) throw new Error('Failed to fetch entries');
    const data: Entry[] = await res.json();
    // AWAIT the mirror write so any row the UI then renders is already in the
    // local mirror; otherwise an edit fired before this lands would enqueue with
    // no LWW baseline and the strict drain gate would drop it (lost write).
    await mergeServerEntries(data).catch(() => {});
    // Layer any still-pending offline mutations back on top so a successful
    // refetch (pull-to-refresh / focus / staleTime) can't erase a queued entry.
    // No-op when nothing is queued.
    const { fromMs, toMs } = rangeForTimeframe(timeframe, dayOffset);
    return overlayPendingOnEntries(data, fromMs, toMs, limit);
  },

  async getEntriesInRange(fromIso: string, toIso: string, limit = 1000): Promise<Entry[]> {
    const headers = await getAuthHeaders();
    const url = `${API_BASE}/api/entries?from_date=${encodeURIComponent(fromIso)}&to_date=${encodeURIComponent(toIso)}&limit=${limit}`;
    let res: Response;
    try {
      res = await trackedFetch(url, { headers });
    } catch {
      return localEntriesForRange(fromIso, toIso, limit);
    }
    if (!res.ok) throw new Error('Failed to fetch entries');
    const data: Entry[] = await res.json();
    // AWAIT the mirror write (see getEntries) so a baseline is always available
    // before the UI can fire an edit against any row from this range.
    await mergeServerEntries(data).catch(() => {});
    // Layer pending offline mutations back on (see getEntries). No-op when the
    // queue is empty; skipped if the range can't be parsed into EST bounds.
    const bounds = rangeForDates(fromIso, toIso);
    if (!bounds) return data;
    return overlayPendingOnEntries(data, bounds.fromMs, bounds.toMs, limit);
  },

  // Full pull of the user's entries into the local mirror (authoritative). Run
  // on login / reconnect after the queues drain, so cold-start offline reads
  // cover EVERY period and server-side deletions are reflected. Throws on
  // network failure so the caller can simply skip the sync when offline.
  async getAllEntries(): Promise<Entry[]> {
    const headers = await getAuthHeaders();
    const url = `${API_BASE}/api/entries?from_date=2000-01-01&to_date=2100-01-01&limit=100000`;
    const res = await trackedFetch(url, { headers });
    if (!res.ok) throw new Error('Failed to fetch entries');
    const data: Entry[] = await res.json();
    await replaceServerEntries(data);
    return data;
  },

  // Raw uploader — no offline queue. Used by the queue drainer itself so
  // it can't recurse. Always throws on failure (network or non-2xx). The
  // thrown Error carries `.status` so callers can classify without regex.
  async createEntryRaw(entry: EntryCreate): Promise<Entry> {
    const headers = await getAuthHeaders();
    const body = JSON.stringify(entry);
    // Hard client-side guard: backend caps receipt_url at 2 MB
    // (MAX_RECEIPT_BYTES). The Replit proxy silently drops oversized POSTs
    // (no response ever comes back), which fetch eventually surfaces as a
    // network error — that gets misclassified as transient and the entry
    // disappears into the offline queue. Fail loudly here instead.
    if (body.length > 1_900_000) {
      const e: any = new Error(`createEntry failed: 413`);
      e.status = 413;
      throw e;
    }
    const res = await trackedFetch(`${API_BASE}/api/entries`, {
      method: 'POST',
      headers,
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const e: any = new Error(`createEntry failed: ${res.status} ${text.slice(0, 200)}`);
      e.status = res.status;
      throw e;
    }
    const saved: Entry = await res.json();
    // Write-through to the local mirror so the offline source of truth (and the
    // LWW baseline for any later offline edit) reflects this server version
    // immediately, not just after the next pull. AWAIT it: a follow-up offline
    // edit must not race ahead and capture a stale baseline before this lands.
    await mergeServerEntries([saved]).catch(() => {});
    return saved;
  },

  // Public createEntry — same shape, but routes failed network calls to
  // the offline queue and returns a synthetic Entry so the UI flow
  // ("you added an entry, here it is on the list") doesn't break. The
  // queue drains on app foreground (see `_layout.tsx`).
  async createEntry(entry: EntryCreate): Promise<Entry> {
    // Stamp a stable idempotency key BEFORE the first attempt so the exact same
    // key is reused if this create falls back to the offline queue and is later
    // replayed — the backend de-duplicates on it, so a timed-out-but-saved POST
    // never becomes a duplicate row. A fresh key per call keeps distinct entries
    // from ever colliding (which would wrongly dedupe a real second entry).
    const withKey: EntryCreate = entry.idempotency_key
      ? entry
      : { ...entry, idempotency_key: newIdempotencyKey() };
    try {
      return await this.createEntryRaw(withKey);
    } catch (err: any) {
      // Classify by actual HTTP status, not by string-matching the message
      // (the old regex missed 422 entirely, which jammed the offline queue
      // with oversized-receipt entries that retried forever).
      // - No status   → network failure, queue it.
      // - 401/408/429 → transient (stale auth / timeout / rate limit), queue.
      // - 5xx         → server hiccup, queue.
      // - Other 4xx   → bad payload, surface the error to the caller.
      const status: number | undefined = err?.status;
      const isTransient =
        status === undefined ||
        status === 401 ||
        status === 408 ||
        status === 429 ||
        (status >= 500 && status < 600);
      if (!isTransient && status >= 400 && status < 500) throw err;
      const { enqueueEntry, synthesizeEntry } = await import('./offlineQueue');
      const item = await enqueueEntry(withKey);
      // Keep the sync indicator's pending count honest right after an offline add
      // (the edit/delete/goal paths already do this).
      await refreshPendingCount();
      // Ask the layout to flush right now (and arm its backoff retry) so a write
      // that hit a transient hiccup syncs while the app stays open — no need to
      // close + reopen to trigger a drain.
      requestDrain();
      return synthesizeEntry(item);
    }
  },

  // Sign In with Apple — exchanges the Apple identity token (returned by
  // expo-apple-authentication's signInAsync) for our own access token.
  // First-name / last-name are only set by Apple on the very first sign-in
  // for an account; the caller should pass them along when they're available.
  async appleSignIn(identity_token: string, first_name?: string, last_name?: string): Promise<AuthResponse> {
    const res = await trackedFetch(`${API_BASE}/api/auth/apple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity_token, first_name, last_name }),
    });
    if (!res.ok) {
      let msg = 'Apple sign-in failed';
      try { const j = await res.json(); if (j?.detail) msg = j.detail; } catch {}
      throw new Error(msg);
    }
    return res.json();
  },

  // User-created platforms (server-persisted per account). GET returns the
  // full list; POST adds one (409 = duplicate, incl. clashes with built-ins).
  async getPlatforms(): Promise<UserPlatform[]> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/platforms`, { headers });
    if (!res.ok) throw new Error('Failed to fetch platforms');
    return res.json();
  },

  // Shared non-2xx error reader for platform/type CRUD. FastAPI validation
  // failures (422) arrive as a LIST of {msg,...} objects — surface the first
  // human-readable message instead of a generic "check your connection",
  // otherwise a name the server rejects looks like a random network failure.
  async _throwApiError(res: Response, fallback: string): Promise<never> {
    let msg = fallback;
    try {
      const j = await res.json();
      if (typeof j?.detail === 'string' && j.detail) {
        msg = j.detail;
      } else if (Array.isArray(j?.detail) && j.detail.length) {
        const m = j.detail[0]?.msg;
        if (typeof m === 'string' && m) msg = m.replace(/^Value error,\s*/i, '');
      }
    } catch {}
    const e: any = new Error(msg);
    e.status = res.status;
    throw e;
  },

  async addPlatform(name: string, color?: string | null, icon?: string | null): Promise<UserPlatform> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/platforms`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: color ?? null, icon: icon ?? null }),
    });
    if (!res.ok) await api._throwApiError(res, 'Failed to add platform');
    return res.json();
  },

  // Per-user cosmetic label overrides for BUILT-IN Platform/Type pills.
  async getLabelOverrides(): Promise<LabelOverride[]> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/labels`, { headers });
    if (!res.ok) throw new Error('Failed to load label overrides');
    return res.json();
  },

  // Upsert one override (empty/undefined label = reset to default). Returns
  // the full override list so callers can replace their cache atomically.
  async setLabelOverride(kind: 'platform' | 'type', key: string, label: string | null): Promise<LabelOverride[]> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/labels`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, key, label }),
    });
    if (!res.ok) await api._throwApiError(res, 'Failed to save the label');
    return res.json();
  },

  // Rename a user-created platform. The server also carries existing entries
  // logged under the old name over to the new one (409 = duplicate name).
  // `color`/`icon` are the FULL desired state (null = reset to auto) — the
  // server overwrites both on every update.
  async renamePlatform(id: number, name: string, color?: string | null, icon?: string | null): Promise<UserPlatform> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/platforms/${id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: color ?? null, icon: icon ?? null }),
    });
    if (!res.ok) await api._throwApiError(res, 'Failed to rename platform');
    return res.json();
  },

  // Delete a user-created platform. Entries logged under it are kept on the
  // server (they store the name as a plain string) — only the pill goes away.
  async deletePlatform(id: number): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/platforms/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok && res.status !== 404) {
      let msg = 'Failed to delete platform';
      try { const j = await res.json(); if (j?.detail) msg = typeof j.detail === 'string' ? j.detail : msg; } catch {}
      const e: any = new Error(msg);
      e.status = res.status;
      throw e;
    }
  },

  // User-created earnings types (server-persisted per account). Same contract
  // shape as platforms: GET list; POST add (409 = duplicate, incl. built-ins);
  // PUT rename/restyle (kind is fixed at creation — server ignores changes);
  // DELETE keeps entries logged under the type.
  async getEntryTypes(): Promise<UserEntryType[]> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/entry-types`, { headers });
    if (!res.ok) throw new Error('Failed to fetch entry types');
    return res.json();
  },

  async addEntryType(name: string, kind: 'income' | 'expense', color?: string | null, icon?: string | null): Promise<UserEntryType> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/entry-types`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind, color: color ?? null, icon: icon ?? null }),
    });
    if (!res.ok) await api._throwApiError(res, 'Failed to add type');
    return res.json();
  },

  async renameEntryType(id: number, name: string, color?: string | null, icon?: string | null): Promise<UserEntryType> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/entry-types/${id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: color ?? null, icon: icon ?? null }),
    });
    if (!res.ok) await api._throwApiError(res, 'Failed to rename type');
    return res.json();
  },

  async deleteEntryType(id: number): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/entry-types/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok && res.status !== 404) {
      let msg = 'Failed to delete type';
      try { const j = await res.json(); if (j?.detail) msg = typeof j.detail === 'string' ? j.detail : msg; } catch {}
      const e: any = new Error(msg);
      e.status = res.status;
      throw e;
    }
  },

  // User-created expense categories (server-persisted per account). Same
  // contract shape as entry types: GET list; POST add (409 = duplicate, incl.
  // built-ins); PUT rename/restyle; DELETE keeps entries filed under it.
  // Built-in categories can additionally be hidden per user (cosmetic).
  async getExpenseCategories(): Promise<UserExpenseCategory[]> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/expense-categories`, { headers });
    if (!res.ok) throw new Error('Failed to fetch expense categories');
    return res.json();
  },

  async addExpenseCategory(name: string, color?: string | null, icon?: string | null): Promise<UserExpenseCategory> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/expense-categories`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: color ?? null, icon: icon ?? null }),
    });
    if (!res.ok) await api._throwApiError(res, 'Failed to add category');
    return res.json();
  },

  async renameExpenseCategory(id: number, name: string, color?: string | null, icon?: string | null): Promise<UserExpenseCategory> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/expense-categories/${id}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: color ?? null, icon: icon ?? null }),
    });
    if (!res.ok) await api._throwApiError(res, 'Failed to rename category');
    return res.json();
  },

  async deleteExpenseCategory(id: number): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/expense-categories/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok && res.status !== 404) {
      let msg = 'Failed to delete category';
      try { const j = await res.json(); if (j?.detail) msg = typeof j.detail === 'string' ? j.detail : msg; } catch {}
      const e: any = new Error(msg);
      e.status = res.status;
      throw e;
    }
  },

  // Hidden BUILT-IN expense-category keys (wholesale replace, idempotent).
  async getHiddenExpenseCategories(): Promise<string[]> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/expense-categories/hidden`, { headers });
    if (!res.ok) throw new Error('Failed to fetch hidden categories');
    return res.json();
  },

  async setHiddenExpenseCategories(keys: string[]): Promise<string[]> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/expense-categories/hidden`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
    if (!res.ok) await api._throwApiError(res, 'Failed to update hidden categories');
    return res.json();
  },

  // Hidden BUILT-IN platform keys (wholesale replace, idempotent).
  async getHiddenPlatforms(): Promise<string[]> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/platforms/hidden`, { headers });
    if (!res.ok) throw new Error('Failed to fetch hidden platforms');
    return res.json();
  },

  async setHiddenPlatforms(keys: string[]): Promise<string[]> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/platforms/hidden`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
    if (!res.ok) await api._throwApiError(res, 'Failed to update hidden platforms');
    return res.json();
  },

  // Hidden BUILT-IN type-pill keys (wholesale replace, idempotent).
  async getHiddenEntryTypes(): Promise<string[]> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/entry-types/hidden`, { headers });
    if (!res.ok) throw new Error('Failed to fetch hidden types');
    return res.json();
  },

  async setHiddenEntryTypes(keys: string[]): Promise<string[]> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/entry-types/hidden`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
    if (!res.ok) await api._throwApiError(res, 'Failed to update hidden types');
    return res.json();
  },

  // Raw DELETE — no offline queue. Used by the mutation-queue drainer so it
  // can't recurse. ALWAYS throws on failure (network or non-2xx); the thrown
  // Error carries `.status` (including 404) so the drainer can classify a
  // remote-deleted row (404 → drop) without regex.
  async deleteEntryRaw(id: number): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/entries/${id}`, { method: 'DELETE', headers });
    if (!res.ok) {
      const e: any = new Error(`deleteEntry failed: ${res.status}`);
      e.status = res.status;
      throw e;
    }
    // Drop from the mirror (AWAITED) so offline reads agree before the next pull.
    await removeLocalEntries([id]).catch(() => {});
  },

  async deleteEntry(id: number): Promise<void> {
    // Optimistic-create and offline-queued rows use a NEGATIVE synthetic id —
    // the server never persisted a row under that id. Firing a DELETE for it
    // returns 404, which is the root cause of the "Failed to delete" seen when
    // deleting a just-added entry on the first attempt (the retry only worked
    // because the failed delete's refetch had meanwhile swapped in the real
    // id). For these ids, drop the row from the offline queue instead so the
    // background drainer won't recreate it, and treat the delete as done.
    if (id < 0) {
      try {
        const { removeQueuedBySyntheticId } = await import('./offlineQueue');
        await removeQueuedBySyntheticId(id);
      } catch {}
      await refreshPendingCount();
      return;
    }
    try {
      await this.deleteEntryRaw(id);
    } catch (err: any) {
      const status: number | undefined = err?.status;
      // Already-gone row (404) — the desired state (row absent) is achieved;
      // treat as success so the optimistic removal isn't rolled back.
      if (status === 404) return;
      const isTransient =
        status === undefined ||
        status === 401 ||
        status === 408 ||
        status === 429 ||
        (status >= 500 && status < 600);
      // Permanent 4xx (bad request) — surface to the caller.
      if (!isTransient && status >= 400 && status < 500) throw err;
      // Network failure / transient — queue the delete and report success so the
      // optimistic removal sticks; the drainer replays it on reconnect. Capture
      // the mirrored row's `updated_at` as the LWW baseline for conflict checks.
      const baseUpdatedAt = (await getLocalEntry(id))?.updated_at;
      const { enqueueMutation } = await import('./mutationQueue');
      await enqueueMutation({ kind: 'deleteEntry', id, baseUpdatedAt });
      await refreshPendingCount();
      requestDrain();
    }
  },

  // Raw partial-update — no offline queue. Used by the drainer. Backend
  // (`PUT /api/entries/{id}`) accepts the same schema as create (incl. `date`
  // + `time` strings). Throws with `.status` on failure.
  async updateEntryRaw(id: number, patch: Partial<EntryCreate>): Promise<Entry> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/entries/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const e: any = new Error(`Failed to update entry: ${res.status} ${text.slice(0, 200)}`);
      e.status = res.status;
      throw e;
    }
    const saved: Entry = await res.json();
    // Write-through (AWAITED) so a subsequent offline edit branches from THIS
    // version's updated_at; otherwise its LWW baseline would be stale and the
    // drainer could wrongly drop it as "older than server".
    await mergeServerEntries([saved]).catch(() => {});
    return saved;
  },

  async updateEntry(id: number, patch: Partial<EntryCreate>): Promise<Entry> {
    // Editing an offline-created row (negative synthetic id) that isn't on the
    // server yet: patch the QUEUED create payload so it syncs with the new
    // values, instead of firing a doomed PUT for an id the server doesn't have.
    if (id < 0) {
      try {
        const { updateQueuedBySyntheticId } = await import('./offlineQueue');
        await updateQueuedBySyntheticId(id, patch);
      } catch {}
      await refreshPendingCount();
      return synthEntryFromPatch(id, patch);
    }
    try {
      return await this.updateEntryRaw(id, patch);
    } catch (err: any) {
      const status: number | undefined = err?.status;
      const isTransient =
        status === undefined ||
        status === 401 ||
        status === 408 ||
        status === 429 ||
        (status >= 500 && status < 600);
      if (!isTransient && status >= 400 && status < 500) throw err;
      const baseUpdatedAt = (await getLocalEntry(id))?.updated_at;
      const { enqueueMutation } = await import('./mutationQueue');
      await enqueueMutation({ kind: 'updateEntry', id, patch, baseUpdatedAt });
      await refreshPendingCount();
      requestDrain();
      return synthEntryFromPatch(id, patch);
    }
  },

  async deleteAccount(): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/auth/account`, { method: 'DELETE', headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || 'Failed to delete account');
    }
  },

  async getGoal(timeframe: TimeframeType): Promise<Goal | null> {
    let res: Response;
    try {
      const headers = await getAuthHeaders();
      res = await trackedFetch(`${API_BASE}/api/goals/${timeframe}`, { headers });
    } catch {
      // Offline → serve the last-known goal from the local mirror.
      return getLocalGoal(timeframe);
    }
    if (!res.ok) {
      // 404 = no goal set; clear any stale local copy so offline reads agree.
      if (res.status === 404) persistGoal(null, timeframe).catch(() => {});
      return null;
    }
    const goal: Goal = await res.json();
    // AWAIT so the goal's updated_at baseline is in the mirror before the UI can
    // fire an offline goal edit (otherwise the strict drain gate could drop it).
    await persistGoal(goal, timeframe).catch(() => {});
    return goal;
  },

  // Raw goal upsert — no offline queue. Used by the drainer. Throws with
  // `.status` on failure so the caller can classify network vs permanent.
  async upsertGoalRaw(timeframe: TimeframeType, target_profit: number): Promise<Goal> {
    const headers = await getAuthHeaders();
    const existing = await api.getGoal(timeframe);
    const method = existing ? 'PUT' : 'POST';
    const url = existing ? `${API_BASE}/api/goals/${timeframe}` : `${API_BASE}/api/goals`;
    const body = existing
      ? JSON.stringify({ target_profit })
      : JSON.stringify({ timeframe, target_profit, goal_name: 'Goal' });
    const res = await trackedFetch(url, { method, headers, body });
    if (!res.ok) {
      const e: any = new Error('Failed to save goal');
      e.status = res.status;
      throw e;
    }
    const saved: Goal = await res.json();
    // Write-through (AWAITED) so a later offline goal edit branches from this
    // version's updated_at for correct per-record LWW.
    await persistGoal(saved, timeframe).catch(() => {});
    return saved;
  },

  async upsertGoal(timeframe: TimeframeType, target_profit: number): Promise<Goal> {
    try {
      return await this.upsertGoalRaw(timeframe, target_profit);
    } catch (err: any) {
      const status: number | undefined = err?.status;
      const isTransient =
        status === undefined ||
        status === 401 ||
        status === 408 ||
        status === 429 ||
        (status >= 500 && status < 600);
      if (!isTransient && status >= 400 && status < 500) throw err;
      const baseUpdatedAt = (await getLocalGoal(timeframe))?.updated_at;
      const { enqueueMutation } = await import('./mutationQueue');
      await enqueueMutation({ kind: 'upsertGoal', timeframe, target_profit, baseUpdatedAt });
      await refreshPendingCount();
      requestDrain();
      // Synthetic goal so the optimistic UI flow doesn't break offline.
      return { id: -1, timeframe, target_profit, goal_name: 'Goal' };
    }
  },

  // ── Per-date daily goals ────────────────────────────────────────────────────
  // Each EST calendar date owns an independent goal (backend daily_goals). The
  // local mirror keys these as `DAILY:YYYY-MM-DD` so offline reads/edits are
  // date-scoped too. Falls back (server-side) to the legacy TODAY row for dates
  // never explicitly edited.

  async getDailyGoal(dateIso: string): Promise<Goal | null> {
    const headers = await getAuthHeaders();
    const key = `DAILY:${dateIso}`;
    let res: Response;
    try {
      res = await trackedFetch(`${API_BASE}/api/goals/daily/${dateIso}`, { headers });
    } catch {
      // Offline → per-date mirror first, then the legacy TODAY default.
      return (await getLocalGoal(key)) ?? (await getLocalGoal('TODAY'));
    }
    if (!res.ok) {
      // Transient/server errors must NOT erase the local per-date mirror —
      // fall back to it (then the legacy default) like the offline path.
      return (await getLocalGoal(key)) ?? (await getLocalGoal('TODAY'));
    }
    const goal: (Goal & { inherited?: boolean }) | null = await res.json();
    if (!goal) {
      await persistGoal(null, key).catch(() => {});
      return null;
    }
    // Only mirror EXPLICIT per-date goals under the date key. An inherited
    // default must not be frozen onto the date, or a later default change
    // would leave a stale per-date copy shadowing it offline.
    if (!goal.inherited) await persistGoal(goal, key).catch(() => {});
    return goal;
  },

  // Raw per-date upsert — no offline queue. Used by the drainer.
  async upsertDailyGoalRaw(dateIso: string, target_profit: number): Promise<Goal> {
    const headers = await getAuthHeaders();
    const res = await trackedFetch(`${API_BASE}/api/goals/daily/${dateIso}`, {
      method: 'PUT', headers, body: JSON.stringify({ target_profit }),
    });
    if (!res.ok) {
      const e: any = new Error('Failed to save daily goal');
      e.status = res.status;
      throw e;
    }
    const saved: Goal = await res.json();
    await persistGoal(saved, `DAILY:${dateIso}`).catch(() => {});
    return saved;
  },

  async upsertDailyGoal(dateIso: string, target_profit: number): Promise<Goal> {
    try {
      return await this.upsertDailyGoalRaw(dateIso, target_profit);
    } catch (err: any) {
      const status: number | undefined = err?.status;
      const isTransient =
        status === undefined ||
        status === 401 ||
        status === 408 ||
        status === 429 ||
        (status >= 500 && status < 600);
      if (!isTransient && status >= 400 && status < 500) throw err;
      const baseUpdatedAt = (await getLocalGoal(`DAILY:${dateIso}`))?.updated_at;
      const { enqueueMutation } = await import('./mutationQueue');
      await enqueueMutation({ kind: 'upsertDailyGoal', date: dateIso, target_profit, baseUpdatedAt });
      await refreshPendingCount();
      requestDrain();
      // Synthetic goal + local mirror so offline reads of THIS date stick.
      const synthetic: Goal = { id: -1, timeframe: 'TODAY', target_profit, goal_name: 'Daily Goal' };
      await persistGoal(synthetic, `DAILY:${dateIso}`).catch(() => {});
      return synthetic;
    }
  },

};

// The `api` every screen imports. While a local sandbox demo session is
// active, any method that demoApi implements is served from the in-memory
// demo store instead of the network — one central switch, zero per-screen
// conditionals. Methods demoApi doesn't implement fall through to the real
// implementation, where trackedFetch's demo guard blocks the request before
// it can leave the device.
export const api: typeof realApi = new Proxy(realApi, {
  get(target, prop, receiver) {
    if (isDemoActive()) {
      const impl = (demoApi as Record<PropertyKey, unknown>)[prop as string];
      if (typeof impl === 'function') return impl;
    }
    return Reflect.get(target, prop, receiver);
  },
});

// Best-effort synthetic Entry returned by the offline `updateEntry` path. The
// caller's mutation onSuccess only invalidates (which fails & is retained
// ─── Report a Problem ────────────────────────────────────────────────────────
export interface ProblemReportPayload {
  report_type: string;
  title?: string;
  description: string;
  steps?: string;
  contact_email: string;
  diagnostics?: Record<string, string>;
  screenshots?: string[]; // data:image/... URLs, client-compressed
}

export async function submitProblemReport(payload: ProblemReportPayload): Promise<{ ok: boolean; id: number }> {
  const headers = await getAuthHeaders();
  const res = await trackedFetch(`${API_BASE}/api/feedback/report`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = 'Could not send your report.';
    try {
      const j = await res.json();
      if (typeof j?.detail === 'string') {
        detail = j.detail;
      } else if (Array.isArray(j?.detail) && j.detail.length) {
        // FastAPI 422 validation errors arrive as a list — surface the first
        // human-readable message instead of the generic fallback.
        const msg = j.detail[0]?.msg;
        if (typeof msg === 'string' && msg) detail = msg.replace(/^Value error,\s*/i, '');
      }
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

// offline), so the optimistic onMutate patch is what the user actually sees —
// this return value is not rendered directly, it just satisfies the Promise<Entry>.
function synthEntryFromPatch(id: number, patch: Partial<EntryCreate>): Entry {
  const now = new Date().toISOString();
  return {
    id,
    timestamp: now,
    type: patch.type ?? 'ORDER',
    app: patch.app ?? 'DOORDASH',
    amount: patch.amount ?? 0,
    distance_miles: patch.distance_miles ?? 0,
    duration_minutes: patch.duration_minutes ?? 0,
    category: patch.category,
    note: patch.note,
    receipt_url: patch.receipt_url,
    is_business_expense: patch.is_business_expense,
    created_at: now,
    updated_at: now,
  };
}
