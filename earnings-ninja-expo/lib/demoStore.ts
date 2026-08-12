// ─── Local sandbox Demo Mode: in-memory data store ───────────────────────────
//
// Holds ALL data for a demo session: entries, goals, custom platforms/types/
// categories, label overrides. Nothing here ever touches AsyncStorage,
// SecureStore, or the network — the whole store is plain module memory, so an
// app restart (or exitDemoSession → destroyDemoStore) always resets to the
// deterministic seed.
//
// Aggregation mirrors backend/services/rollup_service.py (and lib/localStore's
// aggregate) so demo KPIs behave exactly like real ones. All day-bucketing is
// US/Eastern via lib/estRange, matching the rest of the app.

import type {
  Entry, EntryCreate, Goal, Rollup, TimeframeType,
  UserPlatform, UserEntryType, UserExpenseCategory, LabelOverride,
} from './api';
import {
  rangeForTimeframe, rangeForDates, estWallToUTCms, estDateIsoForOffset, parseUTC,
} from './estRange';

// ─── State ───────────────────────────────────────────────────────────────────

interface DemoState {
  entries: Entry[];
  nextId: number;
  goals: Map<string, Goal>; // keyed by TimeframeType or 'DAILY:YYYY-MM-DD'
  nextGoalId: number;
  platforms: UserPlatform[];
  entryTypes: UserEntryType[];
  expenseCats: UserExpenseCategory[];
  hiddenCatKeys: string[];
  hiddenPlatformKeys: string[];
  hiddenTypeKeys: string[];
  labelOverrides: LabelOverride[];
  nextMetaId: number;
}

let state: DemoState | null = null;

function s(): DemoState {
  if (!state) state = buildSeed();
  return state;
}

export function resetDemoStore(): void {
  state = buildSeed();
}

export function destroyDemoStore(): void {
  state = null;
}

// ─── Deterministic PRNG (mulberry32) so every demo session looks identical ───

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Seed dataset ────────────────────────────────────────────────────────────
//
// ~6 weeks of realistic multi-platform gig data, generated relative to
// "today" (EST) so charts, streaks, and goal progress always look current.
// Weekday/weekend rhythm: Fri/Sat/Sun are busier; Tuesdays are slow; a couple
// of days off. Amounts avoid round numbers so nothing looks fake.

const SEED_DAYS = 42;

type SeedPlatform =
  | { app: Entry['app']; custom?: undefined }
  | { app: 'OTHER'; custom: string };

const SEED_PLATFORMS: { p: SeedPlatform; weight: number; avg: number }[] = [
  { p: { app: 'DOORDASH' },                    weight: 34, avg: 11.4 },
  { p: { app: 'UBEREATS' },                    weight: 26, avg: 10.2 },
  { p: { app: 'INSTACART' },                   weight: 16, avg: 21.8 },
  { p: { app: 'OTHER', custom: 'Spark' },      weight: 14, avg: 16.6 },
  { p: { app: 'OTHER', custom: 'Amazon Flex' }, weight: 10, avg: 24.5 },
];

function pickPlatform(rnd: () => number): { p: SeedPlatform; avg: number } {
  const total = SEED_PLATFORMS.reduce((n, x) => n + x.weight, 0);
  let roll = rnd() * total;
  for (const x of SEED_PLATFORMS) {
    roll -= x.weight;
    if (roll <= 0) return x;
  }
  return SEED_PLATFORMS[0];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function isoFor(dayOffset: number): { y: number; m: number; d: number; iso: string } {
  const iso = estDateIsoForOffset(dayOffset);
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d, iso };
}

function tsFor(dayOffset: number, hour: number, minute: number): string {
  const { y, m, d } = isoFor(dayOffset);
  return new Date(estWallToUTCms(y, m, d, hour, minute, 0, 0)).toISOString();
}

function buildSeed(): DemoState {
  const rnd = mulberry32(0xE471964A % 0x7fffffff);
  const entries: Entry[] = [];
  let id = 1;

  const push = (e: Omit<Entry, 'id' | 'created_at' | 'updated_at'>) => {
    entries.push({
      ...e,
      id: id++,
      created_at: e.timestamp,
      updated_at: e.timestamp,
    });
  };

  // EST "now" hour so today's data never appears in the future.
  const nowEst = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const nowHour = nowEst.getHours();

  for (let off = -(SEED_DAYS - 1); off <= 0; off++) {
    const { y, m, d } = isoFor(off);
    // 0=Sun..6=Sat for this EST calendar date.
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

    // Day-off pattern: most Tuesdays and the occasional Monday are skipped.
    if (dow === 2 && rnd() < 0.7) continue;
    if (dow === 1 && rnd() < 0.25) continue;

    const weekend = dow === 5 || dow === 6 || dow === 0;
    let orderCount = weekend ? 6 + Math.floor(rnd() * 5) : 3 + Math.floor(rnd() * 4);

    // Shift windows: lunch (11–14) and dinner (17–21); weekends add late night.
    const slots: [number, number][] = [];
    for (let i = 0; i < orderCount; i++) {
      const dinner = rnd() < (weekend ? 0.7 : 0.6);
      const h = dinner
        ? 17 + Math.floor(rnd() * (weekend ? 5 : 4))
        : 11 + Math.floor(rnd() * 3);
      slots.push([h, Math.floor(rnd() * 60)]);
    }
    slots.sort((a, b) => a[0] * 60 + a[1] - (b[0] * 60 + b[1]));

    for (const [h, min] of slots) {
      // Today: only generate up to the current hour so the dashboard never
      // shows future earnings.
      if (off === 0 && h >= nowHour) continue;
      const { p, avg } = pickPlatform(rnd);
      const spread = avg * (0.45 + rnd() * 1.15); // 0.45x–1.6x of platform avg
      const tip = rnd() < 0.3 ? rnd() * 6 : 0;
      const amount = round2(Math.max(3.75, spread + tip));
      const miles = round2(Math.max(0.8, amount * (0.28 + rnd() * 0.22)));
      const minutes = Math.round(12 + rnd() * 26 + miles * 1.6);
      push({
        timestamp: tsFor(off, h, min),
        type: 'ORDER',
        app: p.app,
        custom_app: p.custom ?? null,
        amount,
        distance_miles: miles,
        duration_minutes: minutes,
      });
    }

    // Occasional quest/streak bonus on busy days.
    if (weekend && rnd() < 0.4 && !(off === 0 && nowHour < 21)) {
      push({
        timestamp: tsFor(off, 21, 5 + Math.floor(rnd() * 40)),
        type: 'BONUS',
        app: rnd() < 0.5 ? 'DOORDASH' : 'UBEREATS',
        custom_app: null,
        amount: round2(8 + rnd() * 17),
        distance_miles: 0,
        duration_minutes: 0,
        note: 'Weekend quest bonus',
      });
    }

    // Gas roughly every other driving day; occasional parking/food expense.
    if (rnd() < 0.5 && !(off === 0 && nowHour < 12)) {
      push({
        timestamp: tsFor(off, 10, 10 + Math.floor(rnd() * 40)),
        type: 'EXPENSE',
        app: 'OTHER',
        custom_app: null,
        amount: -round2(14 + rnd() * 19),
        distance_miles: 0,
        duration_minutes: 0,
        category: 'GAS',
        is_business_expense: true,
      });
    }
    if (rnd() < 0.15 && off !== 0) {
      const food = rnd() < 0.5;
      push({
        timestamp: tsFor(off, food ? 14 : 18, Math.floor(rnd() * 55)),
        type: 'EXPENSE',
        app: 'OTHER',
        custom_app: null,
        amount: -round2(food ? 6 + rnd() * 9 : 2 + rnd() * 5),
        distance_miles: 0,
        duration_minutes: 0,
        category: food ? 'FOOD' : 'PARKING',
        is_business_expense: !food,
      });
    }
  }

  // Sort newest-first like the server does.
  entries.sort((a, b) => parseUTC(b.timestamp).getTime() - parseUTC(a.timestamp).getTime());

  const goals = new Map<string, Goal>();
  const mkGoal = (gid: number, timeframe: TimeframeType, target: number, name: string): Goal => ({
    id: gid, timeframe, target_profit: target, goal_name: name,
    updated_at: new Date().toISOString(),
  });
  goals.set('TODAY', mkGoal(1, 'TODAY', 150, 'Daily Goal'));
  goals.set('THIS_WEEK', mkGoal(2, 'THIS_WEEK', 900, 'Weekly Goal'));
  goals.set('THIS_MONTH', mkGoal(3, 'THIS_MONTH', 3600, 'Monthly Goal'));

  return {
    entries,
    nextId: id,
    goals,
    nextGoalId: 10,
    // Spark & Amazon Flex exist as user-created platforms so their entries
    // display with the right pills — and the custom-platform feature demos itself.
    platforms: [
      { id: 1, name: 'Spark', color: '#0071dc', icon: '✨' },
      { id: 2, name: 'Amazon Flex', color: '#f59e0b', icon: '📦' },
    ],
    entryTypes: [],
    expenseCats: [],
    hiddenCatKeys: [],
    hiddenPlatformKeys: [],
    hiddenTypeKeys: [],
    labelOverrides: [],
    nextMetaId: 10,
  };
}

// ─── Aggregation (mirrors localStore.aggregate / rollup_service.py) ──────────

function inRange(e: Entry, fromMs: number, toMs: number): boolean {
  const t = parseUTC(e.timestamp).getTime();
  return t >= fromMs && t <= toMs;
}

function aggregate(entries: Entry[], goal: Goal | null): Rollup {
  let revenue = 0, expenses = 0, profit = 0, miles = 0, minutes = 0;
  let orderRevenue = 0, orderCount = 0;
  for (const e of entries) {
    const amt = e.amount;
    profit += amt;
    if (amt > 0) revenue += amt; else expenses += Math.abs(amt);
    miles += e.distance_miles || 0;
    minutes += e.duration_minutes || 0;
    if (e.type === 'ORDER') { orderRevenue += amt; orderCount += 1; }
  }
  const hours = minutes > 0 ? minutes / 60 : 0;
  const rollup: Rollup = {
    revenue: round2(revenue),
    expenses: round2(expenses),
    profit: round2(profit),
    miles: round2(miles),
    hours: round2(hours),
    dollars_per_mile: round2(miles > 0 ? profit / miles : 0),
    average_order_value: round2(orderCount > 0 ? orderRevenue / orderCount : 0),
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

function goalForTimeframe(timeframe: string, dayOffset: number): Goal | null {
  const st = s();
  if (timeframe === 'TODAY' || timeframe === 'YESTERDAY') {
    const off = timeframe === 'YESTERDAY' ? -1 : dayOffset;
    const daily = st.goals.get(`DAILY:${estDateIsoForOffset(off)}`);
    if (daily) return daily;
    return st.goals.get('TODAY') ?? null;
  }
  return st.goals.get(timeframe) ?? null;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

const sortDesc = (a: Entry, b: Entry) =>
  parseUTC(b.timestamp).getTime() - parseUTC(a.timestamp).getTime();

export function demoRollup(timeframe: string, dayOffset = 0): Rollup {
  const { fromMs, toMs } = rangeForTimeframe(timeframe, dayOffset);
  return aggregate(s().entries.filter(e => inRange(e, fromMs, toMs)), goalForTimeframe(timeframe, dayOffset));
}

export function demoRollupInRange(fromIso: string, toIso: string): Rollup {
  const bounds = rangeForDates(fromIso, toIso);
  if (!bounds) return aggregate([], null);
  return aggregate(s().entries.filter(e => inRange(e, bounds.fromMs, bounds.toMs)), null);
}

export function demoEntries(timeframe: string, limit = 200, dayOffset = 0): Entry[] {
  const { fromMs, toMs } = rangeForTimeframe(timeframe, dayOffset);
  return s().entries.filter(e => inRange(e, fromMs, toMs)).sort(sortDesc).slice(0, limit);
}

export function demoEntriesInRange(fromIso: string, toIso: string, limit = 1000): Entry[] {
  const bounds = rangeForDates(fromIso, toIso);
  if (!bounds) return [];
  return s().entries.filter(e => inRange(e, bounds.fromMs, bounds.toMs)).sort(sortDesc).slice(0, limit);
}

export function demoAllEntries(): Entry[] {
  return [...s().entries].sort(sortDesc);
}

// ─── Entry mutations ─────────────────────────────────────────────────────────

function timestampFromPayload(date?: string, time?: string): string {
  if (date) {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = (time || '12:00').split(':').map(Number);
    if (y && m && d) return new Date(estWallToUTCms(y, m, d, hh || 0, mm || 0, 0, 0)).toISOString();
  }
  return new Date().toISOString();
}

export function demoCreateEntry(payload: EntryCreate): Entry {
  const st = s();
  const ts = timestampFromPayload(payload.date, payload.time);
  const entry: Entry = {
    id: st.nextId++,
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
    is_business_expense: payload.is_business_expense,
    idempotency_key: payload.idempotency_key,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  st.entries.push(entry);
  st.entries.sort(sortDesc);
  return entry;
}

export function demoUpdateEntry(entryId: number, patch: Partial<EntryCreate>): Entry {
  const st = s();
  const idx = st.entries.findIndex(e => e.id === entryId);
  if (idx < 0) {
    const e: any = new Error('Entry not found');
    e.status = 404;
    throw e;
  }
  const cur = st.entries[idx];
  const next: Entry = { ...cur };
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
  if (patch.receipt_url !== undefined) next.receipt_url = patch.receipt_url;
  if (patch.is_business_expense !== undefined) next.is_business_expense = patch.is_business_expense;
  if (patch.date || patch.time) {
    const curEst = new Date(parseUTC(cur.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dateStr = patch.date
      || `${curEst.getFullYear()}-${String(curEst.getMonth() + 1).padStart(2, '0')}-${String(curEst.getDate()).padStart(2, '0')}`;
    const timeStr = patch.time
      || `${String(curEst.getHours()).padStart(2, '0')}:${String(curEst.getMinutes()).padStart(2, '0')}`;
    next.timestamp = timestampFromPayload(dateStr, timeStr);
  }
  next.updated_at = new Date().toISOString();
  st.entries[idx] = next;
  st.entries.sort(sortDesc);
  return next;
}

export function demoDeleteEntry(entryId: number): void {
  const st = s();
  st.entries = st.entries.filter(e => e.id !== entryId);
}

export function demoImportEntries(payloads: EntryCreate[]): number {
  let count = 0;
  for (const p of payloads) {
    try { demoCreateEntry(p); count++; } catch {}
  }
  return count;
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export function demoGetGoal(timeframe: TimeframeType): Goal | null {
  return s().goals.get(timeframe) ?? null;
}

export function demoUpsertGoal(timeframe: TimeframeType, target: number): Goal {
  const st = s();
  const existing = st.goals.get(timeframe);
  const goal: Goal = {
    id: existing?.id ?? st.nextGoalId++,
    timeframe,
    target_profit: target,
    goal_name: existing?.goal_name ?? 'Goal',
    updated_at: new Date().toISOString(),
  };
  st.goals.set(timeframe, goal);
  return goal;
}

export function demoGetDailyGoal(dateIso: string): (Goal & { inherited?: boolean }) | null {
  const st = s();
  const explicit = st.goals.get(`DAILY:${dateIso}`);
  if (explicit) return explicit;
  const def = st.goals.get('TODAY');
  return def ? { ...def, inherited: true } : null;
}

export function demoUpsertDailyGoal(dateIso: string, target: number): Goal {
  const st = s();
  const key = `DAILY:${dateIso}`;
  const existing = st.goals.get(key);
  const goal: Goal = {
    id: existing?.id ?? st.nextGoalId++,
    timeframe: 'TODAY',
    target_profit: target,
    goal_name: 'Daily Goal',
    updated_at: new Date().toISOString(),
  };
  st.goals.set(key, goal);
  return goal;
}

// ─── Custom platforms / types / categories / labels ─────────────────────────

function conflict(msg: string): never {
  const e: any = new Error(msg);
  e.status = 409;
  throw e;
}

export function demoGetPlatforms(): UserPlatform[] { return [...s().platforms]; }

export function demoAddPlatform(name: string, color?: string | null, icon?: string | null): UserPlatform {
  const st = s();
  const n = name.trim();
  if (st.platforms.some(p => p.name.toLowerCase() === n.toLowerCase())) conflict('That platform already exists.');
  const p: UserPlatform = { id: st.nextMetaId++, name: n, color: color ?? null, icon: icon ?? null };
  st.platforms.push(p);
  return p;
}

export function demoRenamePlatform(pid: number, name: string, color?: string | null, icon?: string | null): UserPlatform {
  const st = s();
  const p = st.platforms.find(x => x.id === pid);
  if (!p) conflict('Platform not found.');
  const oldName = p.name;
  p.name = name.trim(); p.color = color ?? null; p.icon = icon ?? null;
  // Carry entries logged under the old name to the new one (server parity).
  for (const e of st.entries) if (e.custom_app === oldName) e.custom_app = p.name;
  return { ...p };
}

export function demoDeletePlatform(pid: number): void {
  const st = s();
  st.platforms = st.platforms.filter(p => p.id !== pid);
}

export function demoGetEntryTypes(): UserEntryType[] { return [...s().entryTypes]; }

export function demoAddEntryType(name: string, kind: 'income' | 'expense', color?: string | null, icon?: string | null): UserEntryType {
  const st = s();
  const n = name.trim();
  if (st.entryTypes.some(t => t.name.toLowerCase() === n.toLowerCase())) conflict('That type already exists.');
  const t: UserEntryType = { id: st.nextMetaId++, name: n, kind, color: color ?? null, icon: icon ?? null };
  st.entryTypes.push(t);
  return t;
}

export function demoRenameEntryType(tid: number, name: string, color?: string | null, icon?: string | null): UserEntryType {
  const st = s();
  const t = st.entryTypes.find(x => x.id === tid);
  if (!t) conflict('Type not found.');
  const oldName = t.name;
  t.name = name.trim(); t.color = color ?? null; t.icon = icon ?? null;
  for (const e of st.entries) if (e.custom_type === oldName) e.custom_type = t.name;
  return { ...t };
}

export function demoDeleteEntryType(tid: number): void {
  const st = s();
  st.entryTypes = st.entryTypes.filter(t => t.id !== tid);
}

export function demoGetExpenseCats(): UserExpenseCategory[] { return [...s().expenseCats]; }

export function demoAddExpenseCat(name: string, color?: string | null, icon?: string | null): UserExpenseCategory {
  const st = s();
  const n = name.trim();
  if (st.expenseCats.some(c => c.name.toLowerCase() === n.toLowerCase())) conflict('That category already exists.');
  const c: UserExpenseCategory = { id: st.nextMetaId++, name: n, color: color ?? null, icon: icon ?? null };
  st.expenseCats.push(c);
  return c;
}

export function demoRenameExpenseCat(cid: number, name: string, color?: string | null, icon?: string | null): UserExpenseCategory {
  const st = s();
  const c = st.expenseCats.find(x => x.id === cid);
  if (!c) conflict('Category not found.');
  const oldName = c.name;
  c.name = name.trim(); c.color = color ?? null; c.icon = icon ?? null;
  for (const e of st.entries) if (e.custom_category === oldName) e.custom_category = c.name;
  return { ...c };
}

export function demoDeleteExpenseCat(cid: number): void {
  const st = s();
  st.expenseCats = st.expenseCats.filter(c => c.id !== cid);
}

export function demoGetHiddenCats(): string[] { return [...s().hiddenCatKeys]; }

export function demoSetHiddenCats(keys: string[]): string[] {
  s().hiddenCatKeys = [...keys];
  return [...keys];
}

export function demoGetHiddenPlatforms(): string[] { return [...s().hiddenPlatformKeys]; }

export function demoSetHiddenPlatforms(keys: string[]): string[] {
  s().hiddenPlatformKeys = [...keys];
  return [...keys];
}

export function demoGetHiddenTypes(): string[] { return [...s().hiddenTypeKeys]; }

export function demoSetHiddenTypes(keys: string[]): string[] {
  s().hiddenTypeKeys = [...keys];
  return [...keys];
}

export function demoGetLabelOverrides(): LabelOverride[] { return [...s().labelOverrides]; }

export function demoSetLabelOverride(kind: 'platform' | 'type', key: string, label: string | null): LabelOverride[] {
  const st = s();
  st.labelOverrides = st.labelOverrides.filter(o => !(o.kind === kind && o.key === key));
  if (label) st.labelOverrides.push({ kind, key, label });
  return [...st.labelOverrides];
}
