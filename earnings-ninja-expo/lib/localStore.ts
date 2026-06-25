import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Entry, EntryCreate, Goal, Rollup, TimeframeType } from './api';
import { rangeForTimeframe, rangeForDates, estWallToUTCms, parseUTC } from './estRange';
import { getQueuedCreates } from './offlineQueue';
import { getQueuedOps } from './mutationQueue';

// LOCAL SOURCE-OF-TRUTH for offline reads.
//
// Whenever the app successfully fetches entries online, the rows are mirrored
// here; a periodic full sync (api.getAllEntries) replaces the mirror with the
// authoritative server set (this is the "pull" half of two-way sync — after the
// queues are drained, the server state wins). When offline, the read APIs in
// api.ts compute rollups/lists from this mirror PLUS the still-pending offline
// queues, so cold-start offline reads work for ANY period — not just windows
// that happened to be cached by React Query.
//
// All bucketing/aggregation mirrors backend/services/rollup_service.py and
// period.py so locally-computed numbers match the server exactly.

const ENTRIES_KEY = 'local_entries_v1';
const GOALS_KEY = 'local_goals_v1';

// Serialize every read-modify-write against the entries mirror (same model as
// the offline queues) so concurrent merges can't clobber each other.
let storeOp: Promise<unknown> = Promise.resolve();
function withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = storeOp.then(fn, fn);
  storeOp = result.then(() => undefined, () => undefined);
  return result;
}

async function readEntries(): Promise<Entry[]> {
  try {
    const raw = await AsyncStorage.getItem(ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeEntries(items: Entry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(items));
  } catch {
    // Storage full — offline reads degrade to whatever is already persisted.
  }
}

// Upsert server rows into the mirror by id (only real, positive-id rows).
export async function mergeServerEntries(incoming: Entry[]): Promise<void> {
  if (!incoming || incoming.length === 0) return;
  await withStoreLock(async () => {
    const current = await readEntries();
    const byId = new Map<number, Entry>();
    for (const e of current) byId.set(e.id, e);
    for (const e of incoming) {
      if (typeof e.id === 'number' && e.id > 0) byId.set(e.id, e);
    }
    await writeEntries(Array.from(byId.values()));
  });
}

// Replace the mirror with the authoritative full server set (the "pull" half of
// two-way sync). Drops rows deleted on the server / other devices.
export async function replaceServerEntries(all: Entry[]): Promise<void> {
  await withStoreLock(async () => {
    const positives = (all || []).filter(e => typeof e.id === 'number' && e.id > 0);
    await writeEntries(positives);
  });
}

export async function persistGoal(goal: Goal | null, timeframe: TimeframeType): Promise<void> {
  // Serialize via the shared store lock so concurrent goal writes for different
  // timeframes can't clobber each other's read-modify-write of the goal map.
  await withStoreLock(async () => {
    try {
      const raw = await AsyncStorage.getItem(GOALS_KEY);
      const map: Record<string, Goal> = raw ? (JSON.parse(raw) || {}) : {};
      if (goal) map[timeframe] = goal;
      else delete map[timeframe];
      await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(map));
    } catch {
      // best-effort
    }
  });
}

export async function getLocalGoal(timeframe: TimeframeType): Promise<Goal | null> {
  return readGoal(timeframe);
}

async function readGoal(timeframe: TimeframeType): Promise<Goal | null> {
  try {
    const raw = await AsyncStorage.getItem(GOALS_KEY);
    if (!raw) return null;
    const map: Record<string, Goal> = JSON.parse(raw) || {};
    return map[timeframe] ?? null;
  } catch {
    return null;
  }
}

// Apply a queued edit patch (EntryCreate shape) onto a stored Entry, recomputing
// the timestamp only when the date/time changed.
function applyPatch(e: Entry, patch: Partial<EntryCreate>): Entry {
  const next: Entry = { ...e };
  if (patch.amount !== undefined) next.amount = patch.amount;
  if (patch.type !== undefined) next.type = patch.type;
  if (patch.app !== undefined) next.app = patch.app;
  if (patch.distance_miles !== undefined) next.distance_miles = patch.distance_miles;
  if (patch.duration_minutes !== undefined) next.duration_minutes = patch.duration_minutes;
  if (patch.category !== undefined) next.category = patch.category;
  if (patch.note !== undefined) next.note = patch.note;
  if (patch.date || patch.time) {
    const cur = parseUTC(e.timestamp);
    const curEst = new Date(cur.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dateStr = patch.date || `${curEst.getFullYear()}-${String(curEst.getMonth() + 1).padStart(2, '0')}-${String(curEst.getDate()).padStart(2, '0')}`;
    const timeStr = patch.time || `${String(curEst.getHours()).padStart(2, '0')}:${String(curEst.getMinutes()).padStart(2, '0')}`;
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    if (y && m && d) next.timestamp = new Date(estWallToUTCms(y, m, d, hh || 0, mm || 0, 0, 0)).toISOString();
  }
  return next;
}

// Synthesize an Entry for a queued (offline) create, preferring the payload's
// explicit EST date/time for correct window bucketing; falling back to the
// enqueue time.
function synthFromCreate(payload: EntryCreate, queuedAt: number): Entry {
  let ts = new Date(queuedAt).toISOString();
  if (payload.date) {
    const [y, m, d] = payload.date.split('-').map(Number);
    const [hh, mm] = (payload.time || '00:00').split(':').map(Number);
    if (y && m && d) ts = new Date(estWallToUTCms(y, m, d, hh || 0, mm || 0, 0, 0)).toISOString();
  }
  return {
    id: -queuedAt,
    timestamp: ts,
    type: payload.type,
    app: payload.app,
    amount: payload.amount,
    distance_miles: payload.distance_miles ?? 0,
    duration_minutes: payload.duration_minutes ?? 0,
    category: payload.category,
    note: payload.note,
    receipt_url: payload.receipt_url,
    created_at: ts,
    updated_at: ts,
  };
}

// The effective local dataset = synced mirror, with queued edits/deletes applied
// and queued creates added. This is what offline reads aggregate over.
async function effectiveEntries(): Promise<Entry[]> {
  const [base, ops, creates] = await Promise.all([
    readEntries(),
    getQueuedOps(),
    getQueuedCreates(),
  ]);
  const deleted = new Set<number>();
  const edits = new Map<number, Partial<EntryCreate>>();
  for (const op of ops) {
    if (op.kind === 'deleteEntry') deleted.add(op.id);
    else if (op.kind === 'updateEntry') edits.set(op.id, op.patch);
  }
  const list: Entry[] = [];
  for (const e of base) {
    if (deleted.has(e.id)) continue;
    const patch = edits.get(e.id);
    list.push(patch ? applyPatch(e, patch) : e);
  }
  for (const c of creates) list.push(synthFromCreate(c.payload, c.queuedAt));
  return list;
}

function inRange(e: Entry, fromMs: number, toMs: number): boolean {
  const t = parseUTC(e.timestamp).getTime();
  return t >= fromMs && t <= toMs;
}

// Aggregate the given entries into a Rollup, mirroring rollup_service.py for the
// fields the client consumes.
function aggregate(entries: Entry[], goal: Goal | null): Rollup {
  let revenue = 0;
  let expenses = 0;
  let profit = 0;
  let miles = 0;
  let minutes = 0;
  let orderRevenue = 0;
  let orderCount = 0;
  for (const e of entries) {
    const amt = e.amount;
    profit += amt;
    if (amt > 0) revenue += amt;
    else expenses += Math.abs(amt);
    miles += e.distance_miles || 0;
    minutes += e.duration_minutes || 0;
    if (e.type === 'ORDER') { orderRevenue += amt; orderCount += 1; }
  }
  const hours = minutes > 0 ? minutes / 60 : 0;
  const dollarsPerMile = miles > 0 ? profit / miles : 0;
  const averageOrderValue = orderCount > 0 ? orderRevenue / orderCount : 0;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const rollup: Rollup = {
    revenue: round2(revenue),
    expenses: round2(expenses),
    profit: round2(profit),
    miles,
    hours: round2(hours),
    dollars_per_mile: round2(dollarsPerMile),
    average_order_value: round2(averageOrderValue),
  };
  if (goal && goal.target_profit > 0) {
    rollup.goal = { target_profit: goal.target_profit, goal_name: goal.goal_name };
    rollup.goal_progress = Math.min(100, (profit / goal.target_profit) * 100);
  } else {
    rollup.goal = null;
    rollup.goal_progress = null;
  }
  return rollup;
}

// ── Public offline-read API (called by api.ts on network failure) ────────────

export async function localRollupForTimeframe(timeframe: string, dayOffset = 0): Promise<Rollup> {
  const { fromMs, toMs } = rangeForTimeframe(timeframe, dayOffset);
  const [all, goal] = await Promise.all([
    effectiveEntries(),
    readGoal(timeframe as TimeframeType),
  ]);
  return aggregate(all.filter(e => inRange(e, fromMs, toMs)), goal);
}

export async function localRollupForRange(fromIso: string, toIso: string): Promise<Rollup> {
  const bounds = rangeForDates(fromIso, toIso);
  const all = await effectiveEntries();
  if (!bounds) return aggregate([], null);
  return aggregate(all.filter(e => inRange(e, bounds.fromMs, bounds.toMs)), null);
}

function sortByTimeDesc(a: Entry, b: Entry): number {
  return parseUTC(b.timestamp).getTime() - parseUTC(a.timestamp).getTime();
}

export async function localEntriesForTimeframe(timeframe: string, limit = 200, dayOffset = 0): Promise<Entry[]> {
  const { fromMs, toMs } = rangeForTimeframe(timeframe, dayOffset);
  const all = await effectiveEntries();
  return all.filter(e => inRange(e, fromMs, toMs)).sort(sortByTimeDesc).slice(0, limit);
}

export async function localEntriesForRange(fromIso: string, toIso: string, limit = 1000): Promise<Entry[]> {
  const bounds = rangeForDates(fromIso, toIso);
  if (!bounds) return [];
  const all = await effectiveEntries();
  return all.filter(e => inRange(e, bounds.fromMs, bounds.toMs)).sort(sortByTimeDesc).slice(0, limit);
}

export async function clearLocalStore(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([ENTRIES_KEY, GOALS_KEY]);
  } catch {
    // best-effort
  }
}
