import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserTz } from './userTz';
import type { Entry, EntryCreate, Goal, Rollup, TimeframeType } from './api';
import { estDateIsoForOffset, rangeForTimeframe, rangeForDates, estWallToUTCms, parseUTC } from './estRange';
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

// The mirrored server row for one id (positive ids only). Used to capture the
// `updated_at` baseline when an edit/delete is queued offline, so the drainer can
// resolve last-write-wins against the server's current timestamp.
export async function getLocalEntry(id: number): Promise<Entry | undefined> {
  const all = await readEntries();
  return all.find(e => e.id === id);
}

// Drop rows from the mirror (e.g. after a successful server delete) so offline
// reads stop showing them before the next full pull.
export async function removeLocalEntries(ids: number[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const drop = new Set(ids);
  await withStoreLock(async () => {
    const current = await readEntries();
    await writeEntries(current.filter(e => !drop.has(e.id)));
  });
}

export type GoalKey = TimeframeType | string; // string form: 'DAILY:YYYY-MM-DD'

export async function persistGoal(goal: Goal | null, timeframe: GoalKey): Promise<void> {
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

export async function getLocalGoal(timeframe: GoalKey): Promise<Goal | null> {
  return readGoal(timeframe);
}

async function readGoal(timeframe: GoalKey): Promise<Goal | null> {
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
  if (patch.custom_app !== undefined) next.custom_app = patch.custom_app;
  if (patch.custom_type !== undefined) next.custom_type = patch.custom_type;
  if (patch.custom_category !== undefined) next.custom_category = patch.custom_category;
  if (patch.distance_miles !== undefined) next.distance_miles = patch.distance_miles;
  if (patch.duration_minutes !== undefined) next.duration_minutes = patch.duration_minutes;
  if (patch.category !== undefined) next.category = patch.category;
  if (patch.note !== undefined) next.note = patch.note;
  if (patch.date || patch.time) {
    const cur = parseUTC(e.timestamp);
    const curEst = new Date(cur.toLocaleString('en-US', { timeZone: getUserTz() }));
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
    custom_app: payload.custom_app ?? null,
    custom_type: payload.custom_type ?? null,
    custom_category: payload.custom_category ?? null,
    amount: payload.amount,
    distance_miles: payload.distance_miles ?? 0,
    duration_minutes: payload.duration_minutes ?? 0,
    category: payload.category,
    note: payload.note,
    receipt_url: payload.receipt_url,
    created_at: ts,
    updated_at: ts,
    idempotency_key: payload.idempotency_key,
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

// Signed per-entry contribution to the rollup accumulators. Mirrors aggregate()
// below (and backend/services/rollup_service.py): `amount` is signed, so a
// positive amount is revenue and a negative one is an expense.
function contribution(e: Entry): {
  profit: number; revenue: number; expenses: number; miles: number; minutes: number;
} {
  const amt = e.amount;
  return {
    profit: amt,
    revenue: amt > 0 ? amt : 0,
    expenses: amt < 0 ? -amt : 0,
    miles: e.distance_miles || 0,
    minutes: e.duration_minutes || 0,
  };
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
  // Day-scoped periods use the per-date daily-goal mirror first (each EST date
  // owns an independent goal); the legacy timeframe entry is the inherited
  // default for dates never explicitly edited.
  let goalKey: GoalKey = timeframe as TimeframeType;
  if (timeframe === 'TODAY' || timeframe === 'YESTERDAY') {
    const off = timeframe === 'YESTERDAY' ? -1 : dayOffset;
    const daily = await readGoal(`DAILY:${estDateIsoForOffset(off)}`);
    if (daily) {
      const all = await effectiveEntries();
      return aggregate(all.filter(e => inRange(e, fromMs, toMs)), daily);
    }
  }
  const [all, goal] = await Promise.all([
    effectiveEntries(),
    readGoal(goalKey),
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

// ── Pending-queue overlay for the ONLINE success path ────────────────────────
//
// A save that times out (Railway cold-start / flaky tunnel) is parked in the
// offline queue with a negative synthetic id and shown optimistically. The bug:
// the ONLINE read path used to return RAW server data, so the next successful
// refetch (pull-to-refresh, app-focus, or 30s staleTime expiry) overwrote the
// cache with a server set that didn't include the queued row yet — erasing it
// until the foreground drain (which only runs on app reopen). These helpers
// re-apply the still-pending queue ON TOP of authoritative server data so a
// refetch can never drop a not-yet-synced local change. Server stays the source
// of truth for EXISTENCE (a row deleted on the server is gone); only the user's
// own pending creates/edits/deletes are layered back in. Both are a strict
// no-op when nothing is queued, so the fully-online path is byte-for-byte
// unchanged.

// Overlay pending creates/edits/deletes onto an authoritative server entries
// list for the window [fromMs, toMs]. Returns the list sorted newest-first and
// capped at `limit`.
export async function overlayPendingOnEntries(
  serverRows: Entry[],
  fromMs: number,
  toMs: number,
  limit: number,
): Promise<Entry[]> {
  const [ops, creates] = await Promise.all([getQueuedOps(), getQueuedCreates()]);
  // Nothing pending → server response is already ordered + limited; no-op.
  if (ops.length === 0 && creates.length === 0) return serverRows;

  const deleted = new Set<number>();
  const edits = new Map<number, Partial<EntryCreate>>();
  for (const op of ops) {
    if (op.kind === 'deleteEntry') deleted.add(op.id);
    else if (op.kind === 'updateEntry') edits.set(op.id, op.patch);
  }

  // A create can time out client-side yet still reach the server (Railway
  // cold-start). The same idempotency_key rides the first POST and the queued
  // replay, so once the real row lands the server echoes that key back. Track
  // the keys the server already has so we don't ALSO render the still-queued
  // synthetic copy — that would flash a duplicate row until the queue drains.
  const serverKeys = new Set<string>();
  for (const e of serverRows) if (e.idempotency_key) serverKeys.add(e.idempotency_key);

  const list: Entry[] = [];
  const present = new Set<number>();
  for (const e of serverRows) {
    if (deleted.has(e.id)) continue; // a pending (not-yet-synced) delete
    const patch = edits.get(e.id);
    if (!patch) {
      // Unpatched server rows are NEVER re-filtered — a tiny bounds mismatch
      // with the server can therefore never drop a legitimate row.
      list.push(e);
      present.add(e.id);
      continue;
    }
    // A queued edit can change the date/time and move the row out of this
    // window, so re-check the bounds only for patched rows.
    const eff = applyPatch(e, patch);
    if (inRange(eff, fromMs, toMs)) {
      list.push(eff);
      present.add(eff.id);
    }
  }
  // Append still-queued offline creates that fall in this window.
  for (const c of creates) {
    const key = c.payload.idempotency_key;
    if (key && serverKeys.has(key)) continue; // already landed on the server
    const synth = synthFromCreate(c.payload, c.queuedAt);
    if (present.has(synth.id)) continue;
    if (inRange(synth, fromMs, toMs)) list.push(synth);
  }
  return list.sort(sortByTimeDesc).slice(0, limit);
}

// Overlay pending creates/edits/deletes onto an authoritative server rollup for
// the window [fromMs, toMs]. The server rollup already reflects the OLD state of
// any edited/deleted row, so we subtract the old contribution (from the local
// mirror baseline) and add the new one; pending creates are a pure addition.
// average_order_value is left at the server value — recomputing it exactly needs
// the server's order count/revenue components, which the rollup response doesn't
// expose; it self-corrects the instant the queue drains.
export async function overlayPendingOnRollup(
  server: Rollup,
  fromMs: number,
  toMs: number,
  goal: Rollup['goal'],
): Promise<Rollup> {
  const [ops, creates, base] = await Promise.all([
    getQueuedOps(),
    getQueuedCreates(),
    readEntries(),
  ]);
  if (ops.length === 0 && creates.length === 0) return server;

  const byId = new Map<number, Entry>();
  const serverKeys = new Set<string>();
  for (const e of base) {
    byId.set(e.id, e);
    // The mirror reflects the last successful getEntries, so a key present here
    // means that queued create already landed on the server — don't double-count it.
    if (e.idempotency_key) serverKeys.add(e.idempotency_key);
  }

  let dProfit = 0, dRevenue = 0, dExpenses = 0, dMiles = 0, dMinutes = 0;
  const apply = (e: Entry, sign: 1 | -1) => {
    if (!inRange(e, fromMs, toMs)) return;
    const c = contribution(e);
    dProfit += sign * c.profit;
    dRevenue += sign * c.revenue;
    dExpenses += sign * c.expenses;
    dMiles += sign * c.miles;
    dMinutes += sign * c.minutes;
  };

  // Pending creates aren't on the server yet → pure addition. Skip any whose
  // idempotency_key is already in the mirror (the timed-out-but-saved replay) so
  // the server total isn't double-counted.
  for (const c of creates) {
    const key = c.payload.idempotency_key;
    if (key && serverKeys.has(key)) continue;
    apply(synthFromCreate(c.payload, c.queuedAt), 1);
  }

  // Pending edits/deletes act on a real server row. Skip if we have no mirror
  // baseline for it (then the server value simply stands until the drain).
  // upsertGoal ops carry no entry id and don't affect these totals.
  for (const op of ops) {
    if (op.kind === 'deleteEntry') {
      const old = byId.get(op.id);
      if (old) apply(old, -1);
    } else if (op.kind === 'updateEntry') {
      const old = byId.get(op.id);
      if (!old) continue;
      apply(old, -1);
      apply(applyPatch(old, op.patch), 1);
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const profit = round2(server.profit + dProfit);
  const revenue = round2(server.revenue + dRevenue);
  const expenses = round2(server.expenses + dExpenses);
  const miles = round2((server.miles || 0) + dMiles);
  const hours = round2((server.hours || 0) + dMinutes / 60);
  const next: Rollup = {
    ...server,
    profit,
    revenue,
    expenses,
    miles,
    hours,
    dollars_per_mile: round2(miles > 0 ? profit / miles : 0),
    average_order_value: server.average_order_value,
  };
  if (goal && goal.target_profit > 0) {
    next.goal = { target_profit: goal.target_profit, goal_name: goal.goal_name };
    next.goal_progress = Math.min(100, (profit / goal.target_profit) * 100);
  }
  return next;
}

export async function clearLocalStore(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([ENTRIES_KEY, GOALS_KEY]);
  } catch {
    // best-effort
  }
}
