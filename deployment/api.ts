const API_BASE = import.meta.env.VITE_API_BASE || '';

export type EntryType = 'ORDER' | 'BONUS' | 'EXPENSE' | 'CANCELLATION';
export type AppType = 'DOORDASH' | 'UBEREATS' | 'INSTACART' | 'GRUBHUB' | 'SHIPT' | 'OTHER';
export type ExpenseCategory = 'GAS' | 'PARKING' | 'TOLLS' | 'MAINTENANCE' | 'PHONE' | 'SUBSCRIPTION' | 'FOOD' | 'LEISURE' | 'OTHER';
export type TimeframeType = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'LAST_MONTH';

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
  timestamp?: string;
  type: EntryType;
  app: AppType;
  order_id?: string;
  amount: number;
  distance_miles?: number;
  duration_minutes?: number;
  category?: ExpenseCategory;
  note?: string;
  receipt_url?: string;
}

export const getCategoryEmoji = (category: ExpenseCategory): string => {
  switch (category) {
    case 'GAS': return '⛽';
    case 'PARKING': return '🅿️';
    case 'TOLLS': return '🛣️';
    case 'MAINTENANCE': return '🔧';
    case 'PHONE': return '📱';
    case 'SUBSCRIPTION': return '📦';
    case 'FOOD': return '🍔';
    case 'LEISURE': return '🎮';
    case 'OTHER': return '📋';
    default: return '📋';
  }
};

export interface Settings {
  cost_per_mile: number;
}

export interface Goal {
  id: number;
  timeframe: TimeframeType;
  target_profit: number;
  created_at: string;
  updated_at: string;
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
  per_hour_first_to_last: number;
  by_type: Record<string, number>;
  by_app: Record<string, number>;
  goal?: Goal | null;
  goal_progress?: number | null;
}

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.json();
  },

  async getSettings(): Promise<Settings> {
    const res = await fetch(`${API_BASE}/api/settings`);
    return res.json();
  },

  async updateSettings(settings: Settings): Promise<Settings> {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  async createEntry(entry: EntryCreate): Promise<Entry> {
    const res = await fetch(`${API_BASE}/api/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('Failed to create entry');
    return res.json();
  },

  async getEntries(from?: string, to?: string, limit = 100, cursor?: number): Promise<Entry[]> {
    const params = new URLSearchParams();
    if (from) params.append('from_date', from);
    if (to) params.append('to_date', to);
    params.append('limit', limit.toString());
    if (cursor) params.append('cursor', cursor.toString());
    
    const res = await fetch(`${API_BASE}/api/entries?${params}`);
    return res.json();
  },

  async updateEntry(id: number, entry: Partial<EntryCreate>): Promise<Entry> {
    const res = await fetch(`${API_BASE}/api/entries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error('Failed to update entry');
    return res.json();
  },

  async deleteEntry(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/entries/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete entry');
  },

  async deleteAllEntries(): Promise<void> {
    const res = await fetch(`${API_BASE}/api/entries`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete all entries');
  },

  async getRollup(from?: string, to?: string, timeframe?: string): Promise<Rollup> {
    const params = new URLSearchParams();
    if (from) params.append('from_date', from);
    if (to) params.append('to_date', to);
    if (timeframe) params.append('timeframe', timeframe);
    
    const res = await fetch(`${API_BASE}/api/rollup?${params}`);
    if (!res.ok) throw new Error('Failed to fetch rollup');
    return res.json();
  },

  async createGoal(timeframe: TimeframeType, target_profit: number): Promise<Goal> {
    const res = await fetch(`${API_BASE}/api/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeframe, target_profit }),
    });
    if (!res.ok) throw new Error('Failed to create goal');
    return res.json();
  },

  async getGoal(timeframe: TimeframeType): Promise<Goal | null> {
    try {
      const res = await fetch(`${API_BASE}/api/goals/${timeframe}`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async updateGoal(timeframe: TimeframeType, target_profit: number): Promise<Goal> {
    const res = await fetch(`${API_BASE}/api/goals/${timeframe}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_profit }),
    });
    if (!res.ok) throw new Error('Failed to update goal');
    return res.json();
  },

  async deleteGoal(timeframe: TimeframeType): Promise<void> {
    const res = await fetch(`${API_BASE}/api/goals/${timeframe}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete goal');
  },

  async getSuggestions(from?: string, to?: string) {
    const params = new URLSearchParams();
    if (from) params.append('from_date', from);
    if (to) params.append('to_date', to);
    
    const res = await fetch(`${API_BASE}/api/suggestions?${params}`);
    if (!res.ok) throw new Error('Failed to fetch suggestions');
    return res.json();
  },

  async getOAuthStatus(): Promise<Record<string, { connected: boolean; token_expires_at: string | null }>> {
    const res = await fetch(`${API_BASE}/api/oauth/status`);
    if (!res.ok) throw new Error('Failed to fetch OAuth status');
    return res.json();
  },

  async getUberAuthUrl(): Promise<{ auth_url: string }> {
    const res = await fetch(`${API_BASE}/api/oauth/uber/authorize`);
    if (!res.ok) throw new Error('Failed to get Uber auth URL');
    return res.json();
  },

  async getShiptAuthUrl(): Promise<{ auth_url: string }> {
    const res = await fetch(`${API_BASE}/api/oauth/shipt/authorize`);
    if (!res.ok) throw new Error('Failed to get Shipt auth URL');
    return res.json();
  },

  async disconnectPlatform(platform: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/api/oauth/${platform}/disconnect`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to disconnect ${platform}`);
    return res.json();
  },
};
