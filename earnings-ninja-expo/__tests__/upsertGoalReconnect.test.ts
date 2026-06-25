// Integration-style end-to-end test for the offline goal-edit round trip:
// an offline goal upsert gets QUEUED, the device RECONNECTS, the mutation queue
// DRAINS through the real `api.upsertGoalRaw` handler against a mocked-online
// fetch, and the server's saved goal replaces the synthetic optimistic value in
// the ['goal', tf] cache — flushed exactly once, with no duplicates.
//
// Unlike upsertGoalOffline.test.ts (which mocks the queue to isolate the api's
// offline classification), this test exercises the REAL mutationQueue +
// AsyncStorage + api.upsertGoalRaw together, mocking only the native-leaning
// boundaries (token, connectivity, pending-count, local mirror) and the network.

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
  mergeServerEntries: jest.fn(),
  replaceServerEntries: jest.fn(),
  getLocalEntry: jest.fn(),
  removeLocalEntries: jest.fn(),
}));

import { QueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Goal, TimeframeType } from '../lib/api';
import {
  enqueueMutation,
  drainMutationQueue,
  clearMutationQueue,
  getOpQueueDepth,
  type QueuedMutation,
} from '../lib/mutationQueue';

// A tiny stateful "server" backing the mocked fetch: a goal store per timeframe
// plus per-method call counts so we can prove the upsert is pushed exactly once.
function makeServer(seed?: Partial<Record<TimeframeType, Goal>>) {
  const goals = new Map<string, Goal>();
  if (seed) for (const [tf, g] of Object.entries(seed)) if (g) goals.set(tf, g);
  const calls = { GET: 0, POST: 0, PUT: 0 };
  let nextId = 40;

  const fetchImpl = jest.fn(async (url: any, init?: any) => {
    const method: string = init?.method ?? 'GET';
    (calls as any)[method] = ((calls as any)[method] ?? 0) + 1;
    const u = String(url);

    if (method === 'GET') {
      const tf = u.split('/api/goals/')[1];
      const g = goals.get(tf);
      if (!g) return { ok: false, status: 404, json: async () => ({}) } as Response;
      return { ok: true, status: 200, json: async () => g } as Response;
    }
    if (method === 'POST') {
      const body = JSON.parse(init.body);
      const g: Goal = {
        id: ++nextId,
        timeframe: body.timeframe,
        target_profit: body.target_profit,
        goal_name: body.goal_name ?? 'Goal',
        updated_at: '2026-06-25T15:00:00Z',
      } as Goal;
      goals.set(body.timeframe, g);
      return { ok: true, status: 200, json: async () => g } as Response;
    }
    if (method === 'PUT') {
      const tf = u.split('/api/goals/')[1];
      const body = JSON.parse(init.body);
      const prev = goals.get(tf)!;
      const g: Goal = { ...prev, target_profit: body.target_profit, updated_at: '2026-06-25T16:00:00Z' };
      goals.set(tf, g);
      return { ok: true, status: 200, json: async () => g } as Response;
    }
    return { ok: false, status: 500, json: async () => ({}) } as Response;
  });

  return { goals, calls, fetchImpl };
}

// Faithful copy of the upsertGoal branch of the drain's shouldSkip predicate in
// app/_layout.tsx: strict per-record last-write-wins by SERVER updated_at.
async function shouldSkip(op: QueuedMutation): Promise<boolean> {
  if (op.kind !== 'upsertGoal') return false;
  let cur: Goal | null;
  try {
    cur = await api.getGoal(op.timeframe);
  } catch {
    return false; // can't reach server → let the op replay later
  }
  if (!cur || !cur.updated_at) return false; // no server row → nothing to clobber
  if (!op.baseUpdatedAt) return true; // no authoritative baseline → server row wins
  return new Date(cur.updated_at).getTime() > new Date(op.baseUpdatedAt).getTime();
}

const handlers = {
  updateEntry: (id: number, patch: any) => api.updateEntryRaw(id, patch),
  deleteEntry: (id: number) => api.deleteEntryRaw(id),
  upsertGoal: (tf: TimeframeType, target: number) => api.upsertGoalRaw(tf, target),
};

describe('offline goal edit survives a real reconnect (end-to-end)', () => {
  const realFetch = global.fetch;
  let qc: QueryClient;

  beforeEach(async () => {
    qc = new QueryClient();
    await clearMutationQueue();
  });

  afterEach(() => {
    global.fetch = realFetch;
    qc.clear();
  });

  it('flushes the queued upsert exactly once and the cache ends on the server value', async () => {
    const server = makeServer(); // no goal yet → first-time offline set
    global.fetch = server.fetchImpl as unknown as typeof fetch;

    // --- OFFLINE: the Settings optimistic patch put a synthetic goal in cache,
    // and the edit was queued. Simulate repeated offline edits (60 then 75) to
    // prove coalescing keeps a single op so the drain can't push duplicates.
    qc.setQueryData<Goal>(['goal', 'TODAY'], { id: -1, timeframe: 'TODAY', target_profit: 60, goal_name: 'Goal' } as Goal);
    await enqueueMutation({ kind: 'upsertGoal', timeframe: 'TODAY', target_profit: 60 });
    qc.setQueryData<Goal>(['goal', 'TODAY'], { id: -1, timeframe: 'TODAY', target_profit: 75, goal_name: 'Goal' } as Goal);
    await enqueueMutation({ kind: 'upsertGoal', timeframe: 'TODAY', target_profit: 75 });

    expect(await getOpQueueDepth()).toBe(1); // coalesced to one pending op

    // --- RECONNECT: drain the queue with the real upsertGoalRaw handler.
    const r = await drainMutationQueue(handlers, shouldSkip);
    expect(r).toEqual({ flushed: 1, failed: 0, dropped: 0 });

    // Pushed exactly once (create), not duplicated.
    expect(server.calls.POST).toBe(1);
    expect(server.calls.PUT).toBe(0);
    expect(server.goals.get('TODAY')?.target_profit).toBe(75);

    // Queue is now empty; a second drain is a no-op and re-pushes nothing.
    expect(await getOpQueueDepth()).toBe(0);
    const r2 = await drainMutationQueue(handlers, shouldSkip);
    expect(r2.flushed).toBe(0);
    expect(server.calls.POST).toBe(1);

    // --- POST-RECONNECT REFRESH: the ['goal'] invalidation refetches; the cache
    // ends on the SERVER value (real positive id), replacing the synthetic -1.
    const fresh = await api.getGoal('TODAY');
    qc.setQueryData(['goal', 'TODAY'], fresh);
    const cached = qc.getQueryData<Goal>(['goal', 'TODAY']);
    expect(cached?.target_profit).toBe(75);
    expect(cached?.id).toBe(41);
    expect(cached?.id).toBeGreaterThan(0);
  });

  it('LWW: drops the queued upsert when the server goal is newer (no clobber)', async () => {
    // Server already holds a NEWER goal than the version our offline edit branched
    // from (baseUpdatedAt below is strictly older than the server updated_at).
    const server = makeServer({
      THIS_WEEK: { id: 9, timeframe: 'THIS_WEEK', target_profit: 500, goal_name: 'Goal', updated_at: '2026-06-25T12:00:00Z' } as Goal,
    });
    global.fetch = server.fetchImpl as unknown as typeof fetch;

    // Offline optimistic value + queued op carrying the OLD baseline.
    qc.setQueryData<Goal>(['goal', 'THIS_WEEK'], { id: 9, timeframe: 'THIS_WEEK', target_profit: 75, goal_name: 'Goal' } as Goal);
    await enqueueMutation({ kind: 'upsertGoal', timeframe: 'THIS_WEEK', target_profit: 75, baseUpdatedAt: '2026-06-25T10:00:00Z' });

    const r = await drainMutationQueue(handlers, shouldSkip);

    // Op dropped by LWW; nothing written to the server.
    expect(r).toEqual({ flushed: 0, failed: 0, dropped: 1 });
    expect(server.calls.POST).toBe(0);
    expect(server.calls.PUT).toBe(0);
    expect(server.goals.get('THIS_WEEK')?.target_profit).toBe(500);
    expect(await getOpQueueDepth()).toBe(0);

    // Cache ends on the newer SERVER value, not the stale offline 75.
    const fresh = await api.getGoal('THIS_WEEK');
    qc.setQueryData(['goal', 'THIS_WEEK'], fresh);
    expect(qc.getQueryData<Goal>(['goal', 'THIS_WEEK'])?.target_profit).toBe(500);
  });
});
