import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Priority: EXPO_PUBLIC env var → app.json extra → fallback dev URL
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ||
  (Constants.expoConfig?.extra?.apiBase as string | undefined) ||
  'https://b21ea173-8d4d-4445-a8db-6d8c912d7dc4-00-l5lnc6lhje6p.picard.replit.dev';

async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem('auth_token');
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

export interface SuggestionResponse {
  suggestion: string;
  minimum_order: number | null;
  peak_time: string | null;
  average_order: number;
  total_orders: number;
  reasoning: string;
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
    if (!res.ok) throw new Error('Not authenticated');
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

  async getRollup(timeframe: string = 'TODAY'): Promise<Rollup> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/rollup?timeframe=${timeframe}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch rollup');
    return res.json();
  },

  async getEntries(timeframe: string = 'TODAY', limit = 200): Promise<Entry[]> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/entries?timeframe=${timeframe}&limit=${limit}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch entries');
    return res.json();
  },

  async createEntry(entry: EntryCreate): Promise<Entry> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/entries`, {
      method: 'POST',
      headers,
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('Failed to create entry');
    return res.json();
  },

  async deleteEntry(id: number): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/entries/${id}`, { method: 'DELETE', headers });
    if (!res.ok) throw new Error('Failed to delete entry');
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

  async getSuggestions(): Promise<SuggestionResponse> {
    const headers = await getAuthHeaders();
    const now = new Date();
    const from = new Date(now); from.setHours(0, 0, 0, 0);
    const to = new Date(now); to.setHours(23, 59, 59, 999);
    const res = await fetch(
      `${API_BASE}/api/suggestions?from_date=${from.toISOString()}&to_date=${to.toISOString()}`,
      { headers }
    );
    if (!res.ok) throw new Error('Failed to fetch suggestions');
    return res.json();
  },
};
