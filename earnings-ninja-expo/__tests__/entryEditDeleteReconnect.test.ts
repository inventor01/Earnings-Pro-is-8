// Integration-style end-to-end test for the offline transaction EDIT/DELETE
// round trip: an offline `updateEntry` / `deleteEntry` gets QUEUED, the device
// RECONNECTS, the mutation queue DRAINS through the real `api.updateEntryRaw` /
// `api.deleteEntryRaw` handlers against a stateful mocked-online fetch, and each
// op is flushed EXACTLY ONCE (no duplicates).
//
// This mirrors upsertGoalReconnect.test.ts (which covers the goal path) but for
// the two entry paths that were previously only covered in isolation. It also
// exercises the per-record last-write-wins SKIP path (server row newer than the
// op's baseUpdatedAt → dropped) and the 404 "row deleted elsewhere" DROP path.
//
// It drives the REAL mutationQueue + AsyncStorage + api.updateEntryRaw /
// api.deleteEntryRaw together, mocking only the native-leaning boundaries
// (token, connectivity, pending-count, local mirror) and the network. The
// shouldSkip predicate is a faithful copy of the entry branch in app/_layout.tsx:
// strict per-record LWW resolved off the serverTsById map built from getAllEntries.

// Real in-memory AsyncStorage so the real enqueue/drain read-modify-write runs.
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
  removeLocalEntries: jest.fn(async () => {}),
}));

import { api } from '../lib/api';
import type { Entry } from '../lib/api';
import {
  enqueueMutation,
  drainMutationQueue,
  clearMutationQueue,
  getOpQueueDepth,
  type QueuedMutation,
} from '../lib/mutationQueue';

function makeEntry(over: Partial<Entry> & { id: number }): Entry {
  return {
    timestamp: '2026-06-25T12:00:00Z',
    type: 'ORDER',
    app: 'DOORDASH',
    amount: 10,
    distance_miles: 0,
    duration_minutes: 0,
    created_at: '2026-06-25T12:00:00Z',
    updated_at: '2026-06-25T12:00:00Z',
    ...over,
  } as Entry;
}

// A tiny stateful "server" backing the mocked fetch: an entry store by id plus
// per-method call counts so we can prove each op is pushed exactly once.
//  - GET  /api/entries?...      → getAllEntries (used to build serverTsById)
//  - PUT  /api/entries/{id}     → partial update, bumps updated_at
//  - DELETE /api/entries/{id}   → remove (404 if already gone)
function makeServer(seed: Entry[] = []) {
  const entries = new Map<number, Entry>();
  for (const e of seed) entries.set(e.id, e);
  const calls = { GET: 0, PUT: 0, DELETE: 0 };

  const fetchImpl = jest.fn(async (url: any, init?: any) => {
    const method: string = init?.method ?? 'GET';
    (calls as any)[method] = ((calls as any)[method] ?? 0) + 1;
    const u = String(url);

    if (method === 'GET') {
      return { ok: true, status: 200, json: async () => Array.from(entries.values()) } as Response;
    }

    const id = Number(u.split('/api/entries/')[1]);

    if (method === 'PUT') {
      const prev = entries.get(id);
      if (!prev) return { ok: false, status: 404, text: async () => 'not found', json: async () => ({}) } as Response;
      const body = JSON.parse(init.body);
      const next: Entry = { ...prev, ...body, updated_at: '2026-06-25T16:00:00Z' };
      entries.set(id, next);
      return { ok: true, status: 200, json: async () => next } as Response;
    }

    if (method === 'DELETE') {
      if (!entries.has(id)) return { ok: false, status: 404, json: async () => ({}) } as Response;
      entries.delete(id);
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }

    return { ok: false, status: 500, json: async () => ({}) } as Response;
  });

  return { entries, calls, fetchImpl };
}

const handlers = {
  updateEntry: (id: number, patch: any) => api.updateEntryRaw(id, patch),
  deleteEntry: (id: number) => api.deleteEntryRaw(id),
  upsertGoal: (tf: any, target: number) => api.upsertGoalRaw(tf, target),
  upsertDailyGoal: (date: string, target: number) => api.upsertDailyGoalRaw(date, target),
};

// Faithful copy of the entry branch of the drain's shouldSkip predicate in
// app/_layout.tsx: strict per-record LWW off the serverTsById map built from
// the authoritative getAllEntries pull that precedes the drain.
function makeShouldSkip(serverTsById: Map<number, string>) {
  return async function shouldSkip(op: QueuedMutation): Promise<boolean> {
    if (op.kind !== 'updateEntry' && op.kind !== 'deleteEntry') return false;
    const serverTs = serverTsById.get(op.id);
    if (serverTs === undefined) return false; // not on server → handled as 404/remote-delete
    if (!op.baseUpdatedAt) return true; // no authoritative baseline → server row wins
    return new Date(serverTs).getTime() > new Date(op.baseUpdatedAt).getTime();
  };
}

// Build serverTsById exactly as _layout does: from the authoritative pull.
async function buildServerTsById(): Promise<Map<number, string>> {
  const serverEntries = await api.getAllEntries();
  const m = new Map<number, string>();
  for (const e of serverEntries) {
    if (typeof e.id === 'number' && e.id > 0) m.set(e.id, e.updated_at);
  }
  return m;
}

describe('offline transaction edit/delete survive a real reconnect (end-to-end)', () => {
  const realFetch = global.fetch;

  beforeEach(async () => {
    await clearMutationQueue();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('flushes a queued EDIT exactly once (no duplicate PUT) and the server holds the edited value', async () => {
    const server = makeServer([
      makeEntry({ id: 7, amount: 10, updated_at: '2026-06-25T10:00:00Z' }),
    ]);
    global.fetch = server.fetchImpl as unknown as typeof fetch;

    // --- OFFLINE: repeated edits to the same row (amount 12 then 18). Coalescing
    // keeps a single pending op so the drain can't push duplicates; the baseline
    // is the version first seen offline.
    await enqueueMutation({ kind: 'updateEntry', id: 7, patch: { amount: 12 }, baseUpdatedAt: '2026-06-25T10:00:00Z' });
    await enqueueMutation({ kind: 'updateEntry', id: 7, patch: { amount: 18 }, baseUpdatedAt: '2026-06-25T10:00:00Z' });
    expect(await getOpQueueDepth()).toBe(1); // coalesced to one pending op

    // --- RECONNECT: authoritative pull then drain with the real updateEntryRaw.
    const serverTsById = await buildServerTsById();
    const r = await drainMutationQueue(handlers, makeShouldSkip(serverTsById));
    expect(r).toEqual({ flushed: 1, failed: 0, dropped: 0 });

    // Pushed exactly once, carrying the coalesced final value.
    expect(server.calls.PUT).toBe(1);
    expect(server.entries.get(7)?.amount).toBe(18);

    // Queue is empty; a second drain is a no-op and re-pushes nothing.
    expect(await getOpQueueDepth()).toBe(0);
    const r2 = await drainMutationQueue(handlers, makeShouldSkip(serverTsById));
    expect(r2.flushed).toBe(0);
    expect(server.calls.PUT).toBe(1);
  });

  it('flushes a queued DELETE exactly once and the server row is gone', async () => {
    const server = makeServer([
      makeEntry({ id: 9, amount: 25, updated_at: '2026-06-25T10:00:00Z' }),
    ]);
    global.fetch = server.fetchImpl as unknown as typeof fetch;

    await enqueueMutation({ kind: 'deleteEntry', id: 9, baseUpdatedAt: '2026-06-25T10:00:00Z' });
    expect(await getOpQueueDepth()).toBe(1);

    const serverTsById = await buildServerTsById();
    const r = await drainMutationQueue(handlers, makeShouldSkip(serverTsById));
    expect(r).toEqual({ flushed: 1, failed: 0, dropped: 0 });

    // Pushed exactly once and the row is gone.
    expect(server.calls.DELETE).toBe(1);
    expect(server.entries.has(9)).toBe(false);

    // Queue empty; second drain re-pushes nothing.
    expect(await getOpQueueDepth()).toBe(0);
    const r2 = await drainMutationQueue(handlers, makeShouldSkip(serverTsById));
    expect(r2.flushed).toBe(0);
    expect(server.calls.DELETE).toBe(1);
  });

  it('LWW: drops a queued EDIT when the server row is newer (no clobber)', async () => {
    // Server already holds a row NEWER than the version our offline edit branched
    // from (baseUpdatedAt is strictly older than the server updated_at).
    const server = makeServer([
      makeEntry({ id: 11, amount: 99, updated_at: '2026-06-25T12:00:00Z' }),
    ]);
    global.fetch = server.fetchImpl as unknown as typeof fetch;

    await enqueueMutation({ kind: 'updateEntry', id: 11, patch: { amount: 18 }, baseUpdatedAt: '2026-06-25T10:00:00Z' });

    const serverTsById = await buildServerTsById();
    const r = await drainMutationQueue(handlers, makeShouldSkip(serverTsById));

    // Op dropped by LWW; nothing written to the server.
    expect(r).toEqual({ flushed: 0, failed: 0, dropped: 1 });
    expect(server.calls.PUT).toBe(0);
    expect(server.entries.get(11)?.amount).toBe(99);
    expect(await getOpQueueDepth()).toBe(0);
  });

  it('404: drops a queued EDIT for a row deleted elsewhere (remote delete wins)', async () => {
    // The row is gone on the server, so it's absent from serverTsById → shouldSkip
    // returns false (replay), and the PUT then 404s → the op is dropped.
    const server = makeServer([]);
    global.fetch = server.fetchImpl as unknown as typeof fetch;

    await enqueueMutation({ kind: 'updateEntry', id: 13, patch: { amount: 18 }, baseUpdatedAt: '2026-06-25T10:00:00Z' });

    const serverTsById = await buildServerTsById(); // empty
    const r = await drainMutationQueue(handlers, makeShouldSkip(serverTsById));

    expect(r).toEqual({ flushed: 0, failed: 0, dropped: 1 });
    expect(server.calls.PUT).toBe(1); // attempted once, got 404
    expect(await getOpQueueDepth()).toBe(0);
  });

  it('404: drops a queued DELETE for a row deleted elsewhere (remote delete wins)', async () => {
    const server = makeServer([]);
    global.fetch = server.fetchImpl as unknown as typeof fetch;

    await enqueueMutation({ kind: 'deleteEntry', id: 15, baseUpdatedAt: '2026-06-25T10:00:00Z' });

    const serverTsById = await buildServerTsById(); // empty
    const r = await drainMutationQueue(handlers, makeShouldSkip(serverTsById));

    expect(r).toEqual({ flushed: 0, failed: 0, dropped: 1 });
    expect(server.calls.DELETE).toBe(1); // attempted once, got 404
    expect(await getOpQueueDepth()).toBe(0);
  });
});
