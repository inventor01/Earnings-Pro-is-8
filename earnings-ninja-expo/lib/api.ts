import Constants from 'expo-constants';
import { getToken } from './tokenStorage';

// Priority: EXPO_PUBLIC env var → app.json extra → production fallback.
// Production fallback points at the Railway-hosted backend so the shipped
// iOS build keeps working even if the Replit dev environment is offline.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ||
  (Constants.expoConfig?.extra?.apiBase as string | undefined) ||
  'https://earnings-pro-is-8-production.up.railway.app';

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

export type EntryType = 'ORDER' | 'BONUS' | 'EXPENSE' | 'CANCELLATION';
export type AppType = 'DOORDASH' | 'UBEREATS' | 'INSTACART' | 'GRUBHUB' | 'SHIPT' | 'OTHER';
export type ExpenseCategory = 'GAS' | 'PARKING' | 'TOLLS' | 'MAINTENANCE' | 'PHONE' | 'SUBSCRIPTION' | 'FOOD' | 'LEISURE' | 'OTHER';
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
  created_at: string;
  updated_at: string;
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
}

export interface Rollup {
  revenue: number;
  expenses: number;
  profit: number;
  miles: number;
  hours: number;
  dollars_per_mile: number;
  dollars_per_hour: number;
  average_order_value: number;
  goal?: { target_profit: number; goal_name: string } | null;
  goal_progress?: number | null;
}

export interface Settings {
  cost_per_mile: number;
}

export interface Goal {
  id: number;
  timeframe: TimeframeType;
  target_profit: number;
  goal_name: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export const api = {
  async login(credential: string, password: string): Promise<{ access_token: string }> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed');
    }
    return res.json();
  },

  async signup(email: string, password: string, username: string): Promise<{ access_token: string }> {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Signup failed');
    }
    return res.json();
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
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
    const res = await fetch(`${API_BASE}/api/auth/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to start demo');
    return res.json();
  },

  async getMe(): Promise<User> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers });
    if (!res.ok) {
      // Include HTTP status in the message so authContext can distinguish
      // "server explicitly rejected my token" (401/403 → clear token) from
      // "the network is flaky" (500/0 → keep token, retry later).
      throw new Error(`getMe failed: ${res.status}`);
    }
    return res.json();
  },

  // Bulk-import entries (used by the CSV import in Settings). Backend skips
  // any row it can't parse and returns `{ count, message }`.
  async importEntries(entries: EntryCreate[]): Promise<{ count: number; message: string }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/entries/import`, {
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

  async getSettings(): Promise<Settings> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/settings`, { headers });
    return res.json();
  },

  async updateSettings(settings: Settings): Promise<Settings> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  async getRollup(timeframe: string = 'TODAY', dayOffset: number = 0): Promise<Rollup> {
    const headers = await getAuthHeaders();
    const url = dayOffset !== 0 && timeframe === 'TODAY'
      ? `${API_BASE}/api/rollup?timeframe=${timeframe}&day_offset=${dayOffset}`
      : `${API_BASE}/api/rollup?timeframe=${timeframe}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed to fetch rollup');
    return res.json();
  },

  async getRollupInRange(fromIso: string, toIso: string): Promise<Rollup> {
    const headers = await getAuthHeaders();
    const url = `${API_BASE}/api/rollup?from_date=${encodeURIComponent(fromIso)}&to_date=${encodeURIComponent(toIso)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed to fetch rollup');
    return res.json();
  },

  async getEntries(timeframe: string = 'TODAY', limit = 200, dayOffset: number = 0): Promise<Entry[]> {
    const headers = await getAuthHeaders();
    const offsetParam = dayOffset !== 0 && timeframe === 'TODAY' ? `&day_offset=${dayOffset}` : '';
    const res = await fetch(`${API_BASE}/api/entries?timeframe=${timeframe}&limit=${limit}${offsetParam}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch entries');
    return res.json();
  },

  async getEntriesInRange(fromIso: string, toIso: string, limit = 1000): Promise<Entry[]> {
    const headers = await getAuthHeaders();
    const url = `${API_BASE}/api/entries?from_date=${encodeURIComponent(fromIso)}&to_date=${encodeURIComponent(toIso)}&limit=${limit}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed to fetch entries');
    return res.json();
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
    const res = await fetch(`${API_BASE}/api/entries`, {
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
    return res.json();
  },

  // Public createEntry — same shape, but routes failed network calls to
  // the offline queue and returns a synthetic Entry so the UI flow
  // ("you added an entry, here it is on the list") doesn't break. The
  // queue drains on app foreground (see `_layout.tsx`).
  async createEntry(entry: EntryCreate): Promise<Entry> {
    try {
      return await this.createEntryRaw(entry);
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
      const item = await enqueueEntry(entry);
      return synthesizeEntry(item);
    }
  },

  // Sign In with Apple — exchanges the Apple identity token (returned by
  // expo-apple-authentication's signInAsync) for our own access token.
  // First-name / last-name are only set by Apple on the very first sign-in
  // for an account; the caller should pass them along when they're available.
  async appleSignIn(identity_token: string, first_name?: string, last_name?: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/api/auth/apple`, {
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

  async deleteEntry(id: number): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/entries/${id}`, { method: 'DELETE', headers });
    if (!res.ok) throw new Error('Failed to delete entry');
  },

  // Partial-update an entry. Backend (`PUT /api/entries/{id}`) accepts the
  // same EntryUpdate schema as create — including `date` + `time` strings
  // which are converted to a UTC timestamp using America/New_York for proper
  // calendar-day boundaries. Pass only the fields the user actually changed.
  async updateEntry(id: number, patch: Partial<EntryCreate>): Promise<Entry> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/entries/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to update entry: ${res.status} ${text.slice(0, 200)}`);
    }
    return res.json();
  },

  async deleteAccount(): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/auth/account`, { method: 'DELETE', headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || 'Failed to delete account');
    }
  },

  async getGoal(timeframe: TimeframeType): Promise<Goal | null> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/goals/${timeframe}`, { headers });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  },

  async upsertGoal(timeframe: TimeframeType, target_profit: number): Promise<Goal> {
    const headers = await getAuthHeaders();
    const existing = await api.getGoal(timeframe);
    const method = existing ? 'PUT' : 'POST';
    const url = existing ? `${API_BASE}/api/goals/${timeframe}` : `${API_BASE}/api/goals`;
    const body = existing
      ? JSON.stringify({ target_profit })
      : JSON.stringify({ timeframe, target_profit, goal_name: 'Goal' });
    const res = await fetch(url, { method, headers, body });
    if (!res.ok) throw new Error('Failed to save goal');
    return res.json();
  },

};
