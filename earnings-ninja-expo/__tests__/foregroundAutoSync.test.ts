// Covers the "syncs while the app stays open" path (no close/reopen needed).
//
// Two layers:
//  1. syncTrigger — the registerDrainHandler/requestDrain bridge that lets the
//     non-React api.ts ask the layout to flush the moment a write is queued.
//  2. End-to-end create round trip — a create that hits a TRANSIENT server
//     hiccup (5xx, server still reachable so connectivity never flips offline)
//     gets QUEUED, fires requestDrain, and a subsequent drain (the foreground
//     auto-retry, NOT an app restart) flushes it EXACTLY ONCE. The reused
//     idempotency key guarantees that even if the timed-out POST had actually
//     persisted server-side, the replay can't create a duplicate row.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../lib/tokenStorage', () => ({
  getToken: jest.fn(async () => 'test-token'),
}));
jest.mock('../lib/connectivity', () => ({
  reportSuccess: jest.fn(),
  reportFailure: jest.fn(),
}));
jest.mock('../lib/pendingCount', () => ({
  refreshPendingCount: jest.fn(async () => {}),
}));
jest.mock('../lib/localStore', () => ({
  persistGoal: jest.fn(async () => {}),
  getLocalGoal: jest.fn(async () => null),
  localRollupForTimeframe: jest.fn(),
  localRollupForRange: jest.fn(),
  localEntriesForTimeframe: jest.fn(),
  localEntriesForRange: jest.fn(),
  mergeServerEntries: jest.fn(async () => {}),
  replaceServerEntries: jest.fn(async () => {}),
  getLocalEntry: jest.fn(),
  removeLocalEntries: jest.fn(),
  overlayPendingOnEntries: jest.fn(),
  overlayPendingOnRollup: jest.fn(),
}));

import { api } from '../lib/api';
import type { Entry, EntryCreate } from '../lib/api';
import { registerDrainHandler, requestDrain } from '../lib/syncTrigger';
import { drainQueue, clearQueue, getQueueDepth, getQueuedCreates } from '../lib/offlineQueue';

describe('syncTrigger bridge', () => {
  it('routes requestDrain to the registered handler and stops after unregister', () => {
    const handler = jest.fn();
    const unregister = registerDrainHandler(handler);

    requestDrain();
    requestDrain();
    expect(handler).toHaveBeenCalledTimes(2);

    unregister();
    requestDrain();
    expect(handler).toHaveBeenCalledTimes(2); // no further calls after unregister
  });

  it('is a safe no-op when no handler is registered', () => {
    expect(() => requestDrain()).not.toThrow();
  });

  it('only the most-recently-registered handler receives the trigger', () => {
    const first = jest.fn();
    const second = jest.fn();
    registerDrainHandler(first);
    const unregisterSecond = registerDrainHandler(second);

    requestDrain();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    unregisterSecond();
  });
});

// A tiny stateful "server": the first POST returns a 5xx hiccup, every POST
// after that succeeds. It dedupes on idempotency_key so a replay of an
// already-persisted key returns the existing row instead of inserting a copy.
function makeFlakyServer() {
  const rows = new Map<string, Entry>(); // keyed by idempotency_key
  const calls = { POST: 0 };
  let nextId = 100;
  let failNextPost = true;

  const fetchImpl = jest.fn(async (url: any, init?: any) => {
    const method: string = init?.method ?? 'GET';
    if (method !== 'POST') return { ok: false, status: 404, text: async () => '' } as Response;
    calls.POST += 1;

    if (failNextPost) {
      failNextPost = false;
      return { ok: false, status: 503, text: async () => 'hiccup' } as Response;
    }

    const body: EntryCreate = JSON.parse(init.body);
    const key = body.idempotency_key ?? `nokey_${calls.POST}`;
    const existing = rows.get(key);
    if (existing) {
      // Idempotent replay — return the already-saved row, no new insert.
      return { ok: true, status: 200, json: async () => existing } as Response;
    }
    const saved: Entry = {
      id: ++nextId,
      timestamp: '2026-06-30T12:00:00Z',
      type: body.type,
      app: body.app,
      amount: body.amount,
      distance_miles: body.distance_miles ?? 0,
      duration_minutes: body.duration_minutes ?? 0,
      category: body.category,
      note: body.note,
      receipt_url: body.receipt_url,
      created_at: '2026-06-30T12:00:00Z',
      updated_at: '2026-06-30T12:00:00Z',
    } as Entry;
    rows.set(key, saved);
    return { ok: true, status: 200, json: async () => saved } as Response;
  });

  return { rows, calls, fetchImpl };
}

describe('create syncs while the app stays open (transient hiccup → auto-retry)', () => {
  const realFetch = global.fetch;

  beforeEach(async () => {
    await clearQueue();
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('queues the create on a 5xx, fires requestDrain, and a later drain flushes it exactly once', async () => {
    const server = makeFlakyServer();
    global.fetch = server.fetchImpl as unknown as typeof fetch;

    const drainSpy = jest.fn();
    const unregister = registerDrainHandler(drainSpy);

    const payload: EntryCreate = { type: 'ORDER', app: 'DOORDASH', amount: 25 } as EntryCreate;

    // --- First save hits the transient 5xx: createEntry must NOT throw, must
    // return a synthetic (negative-id) row, queue the entry, and ask for a drain.
    const synthetic = await api.createEntry(payload);
    expect(synthetic.id).toBeLessThan(0);
    expect(await getQueueDepth()).toBe(1);
    expect(drainSpy).toHaveBeenCalledTimes(1); // requestDrain fired on enqueue
    expect(server.calls.POST).toBe(1); // only the failed attempt so far

    // A pending create is still editable. Updating its negative synthetic id
    // must patch the queued CREATE (not issue a doomed PUT), so reconnect
    // uploads the corrected amount/note exactly once.
    await api.updateEntry(synthetic.id, { amount: 42, note: 'corrected before sync' });
    const [pending] = await getQueuedCreates();
    expect(pending.payload.amount).toBe(42);
    expect(pending.payload.note).toBe('corrected before sync');
    expect(server.calls.POST).toBe(1); // no PUT/extra request while pending

    unregister();

    // --- The foreground auto-retry drains the queue WITHOUT an app restart.
    const r = await drainQueue(api.createEntryRaw.bind(api));
    expect(r).toEqual({ flushed: 1, failed: 0, dropped: 0 });
    expect(server.calls.POST).toBe(2); // the successful replay
    expect(server.rows.size).toBe(1); // exactly one row created
    expect([...server.rows.values()][0]).toMatchObject({
      amount: 42,
      note: 'corrected before sync',
    });
    expect(await getQueueDepth()).toBe(0);

    // --- A second drain is a no-op: the queue is empty, nothing re-pushed.
    const r2 = await drainQueue(api.createEntryRaw.bind(api));
    expect(r2.flushed).toBe(0);
    expect(server.calls.POST).toBe(2);
    expect(server.rows.size).toBe(1); // still no duplicate
  });
});
