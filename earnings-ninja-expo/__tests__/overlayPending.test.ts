// Guards the "saved entry must appear INSTANTLY and a pull-to-refresh must never
// erase it" fix. The bug: the ONLINE read path returned RAW server data, so a
// successful refetch (pull-to-refresh / app-focus / 30s staleTime) while an
// entry was still parked in the offline queue (timed-out save → negative
// synthetic id) overwrote the cache with a server set that didn't include it
// yet — the entry vanished until the foreground drain on app reopen. The fix
// layers the still-pending queue ON TOP of authoritative server data on the
// success path too, via overlayPendingOnEntries / overlayPendingOnRollup.
//
// Real in-memory AsyncStorage so the local mirror (readEntries/mergeServerEntries)
// behaves like production; only the two queue READERS are mocked so each test can
// declare exactly what is pending.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../lib/offlineQueue', () => ({
  getQueuedCreates: jest.fn(async () => []),
}));
jest.mock('../lib/mutationQueue', () => ({
  getQueuedOps: jest.fn(async () => []),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  overlayPendingOnEntries,
  overlayPendingOnRollup,
  mergeServerEntries,
} from '../lib/localStore';
import { rangeForTimeframe } from '../lib/estRange';
import type { Entry, EntryCreate, Rollup } from '../lib/api';
import { getQueuedCreates } from '../lib/offlineQueue';
import { getQueuedOps } from '../lib/mutationQueue';

const mockCreates = getQueuedCreates as jest.MockedFunction<typeof getQueuedCreates>;
const mockOps = getQueuedOps as jest.MockedFunction<typeof getQueuedOps>;

// TODAY's EST window — deterministic relative to whenever the suite runs.
const { fromMs, toMs } = rangeForTimeframe('TODAY', 0);
const MID = Math.floor((fromMs + toMs) / 2); // safely inside today
const OUTSIDE = toMs + 24 * 60 * 60 * 1000; // a day past the window

const iso = (ms: number) => new Date(ms).toISOString();

function makeEntry(over: Partial<Entry> = {}): Entry {
  const ts = iso(MID);
  return {
    id: 1,
    timestamp: ts,
    type: 'ORDER',
    app: 'DOORDASH',
    amount: 10,
    distance_miles: 0,
    duration_minutes: 0,
    category: undefined,
    note: undefined,
    receipt_url: undefined,
    created_at: ts,
    updated_at: ts,
    ...over,
  };
}

function queuedCreate(payload: Partial<EntryCreate>, queuedAt: number) {
  return {
    clientId: `c_${queuedAt}`,
    queuedAt,
    payload: {
      type: 'ORDER',
      app: 'DOORDASH',
      amount: 0,
      ...payload,
    } as EntryCreate,
  };
}

// A server row that originated from a queued create (same idempotency_key) —
// the timed-out-but-saved replay scenario.
function makeServerRowWithKey(key: string, over: Partial<Entry> = {}): Entry {
  return makeEntry({ idempotency_key: key, ...over });
}

function makeRollup(over: Partial<Rollup> = {}): Rollup {
  return {
    revenue: 100,
    expenses: 0,
    profit: 100,
    miles: 10,
    hours: 1,
    dollars_per_mile: 10,
    average_order_value: 25,
    goal: null,
    goal_progress: null,
    ...over,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockCreates.mockResolvedValue([]);
  mockOps.mockResolvedValue([]);
});

describe('overlayPendingOnEntries', () => {
  it('is a strict no-op (same reference) when nothing is queued', async () => {
    const server = [makeEntry({ id: 1 }), makeEntry({ id: 2 })];
    const out = await overlayPendingOnEntries(server, fromMs, toMs, 200);
    expect(out).toBe(server);
  });

  it('keeps a pending offline create that the server does not have yet', async () => {
    // The exact pull-to-refresh-erases-the-new-entry scenario.
    mockCreates.mockResolvedValue([queuedCreate({ amount: 15 }, MID + 1000)] as any);
    const server = [makeEntry({ id: 1 })];
    const out = await overlayPendingOnEntries(server, fromMs, toMs, 200);
    expect(out).toHaveLength(2);
    expect(out.some(e => e.id === -(MID + 1000))).toBe(true);
  });

  it('drops a pending create that falls outside the window', async () => {
    mockCreates.mockResolvedValue([
      queuedCreate({ amount: 15, date: '2000-01-01', time: '00:00' }, OUTSIDE),
    ] as any);
    const server = [makeEntry({ id: 1 })];
    const out = await overlayPendingOnEntries(server, fromMs, toMs, 200);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(1);
  });

  it('removes a server row that has a pending (not-yet-synced) delete', async () => {
    mockOps.mockResolvedValue([
      { clientId: 'd1', queuedAt: 1, kind: 'deleteEntry', id: 2 },
    ] as any);
    const server = [makeEntry({ id: 1 }), makeEntry({ id: 2 })];
    const out = await overlayPendingOnEntries(server, fromMs, toMs, 200);
    expect(out.map(e => e.id)).toEqual([1]);
  });

  it('applies a pending edit to the matching server row', async () => {
    mockOps.mockResolvedValue([
      { clientId: 'u1', queuedAt: 1, kind: 'updateEntry', id: 2, patch: { amount: -50, type: 'EXPENSE' } },
    ] as any);
    const server = [makeEntry({ id: 2, amount: 10 })];
    const out = await overlayPendingOnEntries(server, fromMs, toMs, 200);
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(-50);
  });

  it('drops a row whose pending edit moves its date out of the window', async () => {
    mockOps.mockResolvedValue([
      { clientId: 'u1', queuedAt: 1, kind: 'updateEntry', id: 2, patch: { date: '2000-01-01', time: '00:00' } },
    ] as any);
    const server = [makeEntry({ id: 1 }), makeEntry({ id: 2 })];
    const out = await overlayPendingOnEntries(server, fromMs, toMs, 200);
    expect(out.map(e => e.id)).toEqual([1]);
  });

  it('never re-filters an UNPATCHED server row (no bounds-mismatch data loss)', async () => {
    // A server row sitting exactly on the window edge must survive even though
    // the queue is non-empty (an unrelated pending create elsewhere).
    mockCreates.mockResolvedValue([
      queuedCreate({ amount: 1, date: '2000-01-01', time: '00:00' }, OUTSIDE),
    ] as any);
    const edge = makeEntry({ id: 9, timestamp: iso(toMs), created_at: iso(toMs), updated_at: iso(toMs) });
    const out = await overlayPendingOnEntries([edge], fromMs, toMs, 200);
    expect(out.map(e => e.id)).toEqual([9]);
  });

  it('suppresses a queued create once its real row landed (matching idempotency_key)', async () => {
    // Timed-out-but-saved: the create is still queued AND the server now returns
    // the real row carrying the same idempotency_key — must show exactly one row.
    mockCreates.mockResolvedValue([
      queuedCreate({ amount: 15, idempotency_key: 'ik_dupe' }, MID + 1000),
    ] as any);
    const server = [makeServerRowWithKey('ik_dupe', { id: 42, amount: 15 })];
    const out = await overlayPendingOnEntries(server, fromMs, toMs, 200);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(42); // the real server row, not the synthetic copy
  });

  it('still shows a queued create when no server row shares its key', async () => {
    mockCreates.mockResolvedValue([
      queuedCreate({ amount: 15, idempotency_key: 'ik_only' }, MID + 1000),
    ] as any);
    const server = [makeServerRowWithKey('ik_other', { id: 42 })];
    const out = await overlayPendingOnEntries(server, fromMs, toMs, 200);
    expect(out).toHaveLength(2);
  });

  it('returns rows newest-first and capped at the limit', async () => {
    mockCreates.mockResolvedValue([queuedCreate({ amount: 5 }, MID + 5000)] as any);
    const server = [
      makeEntry({ id: 1, timestamp: iso(MID - 2000) }),
      makeEntry({ id: 2, timestamp: iso(MID - 1000) }),
    ];
    const out = await overlayPendingOnEntries(server, fromMs, toMs, 2);
    expect(out).toHaveLength(2);
    // Newest = the queued create (MID + 5000), then id 2 (MID - 1000).
    expect(out[0].id).toBe(-(MID + 5000));
    expect(out[1].id).toBe(2);
  });
});

describe('overlayPendingOnRollup', () => {
  it('is a strict no-op (same reference) when nothing is queued', async () => {
    const server = makeRollup();
    const out = await overlayPendingOnRollup(server, fromMs, toMs, null);
    expect(out).toBe(server);
  });

  it('adds an in-range pending ORDER create to the KPIs and recomputes $/mile', async () => {
    mockCreates.mockResolvedValue([
      queuedCreate({ amount: 20, distance_miles: 5 }, MID + 1000),
    ] as any);
    const out = await overlayPendingOnRollup(makeRollup(), fromMs, toMs, null);
    expect(out.profit).toBe(120);
    expect(out.revenue).toBe(120);
    expect(out.miles).toBe(15);
    expect(out.dollars_per_mile).toBe(8); // 120 / 15
  });

  it('adds a pending EXPENSE create (negative amount) to expenses, lowering profit', async () => {
    mockCreates.mockResolvedValue([
      queuedCreate({ amount: -30, type: 'EXPENSE' }, MID + 1000),
    ] as any);
    const out = await overlayPendingOnRollup(makeRollup(), fromMs, toMs, null);
    expect(out.profit).toBe(70);
    expect(out.expenses).toBe(30);
    expect(out.revenue).toBe(100);
  });

  it('ignores a pending create that falls outside the window', async () => {
    mockCreates.mockResolvedValue([
      queuedCreate({ amount: 999, date: '2000-01-01', time: '00:00' }, OUTSIDE),
    ] as any);
    const out = await overlayPendingOnRollup(makeRollup(), fromMs, toMs, null);
    expect(out.profit).toBe(100);
  });

  it('recomputes goal_progress from the overlaid profit', async () => {
    mockCreates.mockResolvedValue([queuedCreate({ amount: 20 }, MID + 1000)] as any);
    const out = await overlayPendingOnRollup(
      makeRollup({ goal: { target_profit: 200, goal_name: 'Rent' }, goal_progress: 50 }),
      fromMs, toMs,
      { id: 1, target_profit: 200, goal_name: 'Rent' } as any,
    );
    expect(out.goal_progress).toBe(60); // 120 / 200
  });

  it('subtracts a pending delete using the local mirror baseline', async () => {
    await mergeServerEntries([makeEntry({ id: 7, amount: 30 })]);
    mockOps.mockResolvedValue([
      { clientId: 'd1', queuedAt: 1, kind: 'deleteEntry', id: 7 },
    ] as any);
    const out = await overlayPendingOnRollup(makeRollup(), fromMs, toMs, null);
    expect(out.profit).toBe(70); // 100 - 30
    expect(out.revenue).toBe(70);
  });

  it('applies a pending edit as (new − old) using the mirror baseline', async () => {
    await mergeServerEntries([makeEntry({ id: 7, amount: 30 })]);
    mockOps.mockResolvedValue([
      { clientId: 'u1', queuedAt: 1, kind: 'updateEntry', id: 7, patch: { amount: 50 } },
    ] as any);
    const out = await overlayPendingOnRollup(makeRollup(), fromMs, toMs, null);
    expect(out.profit).toBe(120); // 100 - 30 + 50
    expect(out.revenue).toBe(120);
  });

  it('leaves the server value untouched for an op with no mirror baseline', async () => {
    // No mergeServerEntries → id 7 is not in the mirror, so we can't know its old
    // contribution; the server total must stand rather than be corrupted.
    mockOps.mockResolvedValue([
      { clientId: 'd1', queuedAt: 1, kind: 'deleteEntry', id: 7 },
    ] as any);
    const out = await overlayPendingOnRollup(makeRollup(), fromMs, toMs, null);
    expect(out.profit).toBe(100);
  });

  it('does NOT double-count a queued create already reflected in the mirror', async () => {
    // The timed-out-but-saved replay: the real row (same key) is already in the
    // local mirror AND the server rollup, yet the create is still queued.
    await mergeServerEntries([makeServerRowWithKey('ik_dupe', { id: 42, amount: 20 })]);
    mockCreates.mockResolvedValue([
      queuedCreate({ amount: 20, idempotency_key: 'ik_dupe' }, MID + 1000),
    ] as any);
    const out = await overlayPendingOnRollup(makeRollup(), fromMs, toMs, null);
    expect(out.profit).toBe(100); // server total stands — no +20 double-count
    expect(out.revenue).toBe(100);
  });

  it('leaves average_order_value at the server value (self-corrects on drain)', async () => {
    mockCreates.mockResolvedValue([
      queuedCreate({ amount: 20, distance_miles: 5 }, MID + 1000),
    ] as any);
    const out = await overlayPendingOnRollup(makeRollup({ average_order_value: 25 }), fromMs, toMs, null);
    expect(out.average_order_value).toBe(25);
  });
});
