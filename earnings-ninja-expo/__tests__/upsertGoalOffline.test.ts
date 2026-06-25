// Verifies the offline branch of api.upsertGoal: when the network is down, the
// call must NOT throw — it enqueues the goal upsert and returns a synthetic
// success so the Settings optimistic patch survives (no onError → no rollback).
//
// The api module's native-leaning boundaries are mocked so only the real
// offline-classification logic in api.upsertGoal is under test.

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

const mockEnqueueMutation = jest.fn(async (_input: any) => {});
jest.mock('../lib/mutationQueue', () => ({
  enqueueMutation: (input: any) => mockEnqueueMutation(input),
}));

import { api } from '../lib/api';

describe('api.upsertGoal offline behavior', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    mockEnqueueMutation.mockClear();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('enqueues and returns a synthetic success when the network is unreachable', async () => {
    // Simulate a hard network failure for every request.
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    const result = await api.upsertGoal('THIS_WEEK', 250);

    // Did not throw; returned the synthetic goal that keeps the optimistic UI intact.
    expect(result).toEqual({
      id: -1,
      timeframe: 'THIS_WEEK',
      target_profit: 250,
      goal_name: 'Goal',
    });

    // The edit was queued for later sync.
    expect(mockEnqueueMutation).toHaveBeenCalledTimes(1);
    expect(mockEnqueueMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'upsertGoal',
        timeframe: 'THIS_WEEK',
        target_profit: 250,
      }),
    );
  });

  it('re-throws on a permanent 4xx (does NOT enqueue)', async () => {
    // getGoal probe → 404 (no existing goal); POST upsert → 400 permanent error.
    global.fetch = jest.fn(async (url: any, init?: any) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      }
      return { ok: false, status: 400, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await expect(api.upsertGoal('TODAY', 10)).rejects.toMatchObject({ status: 400 });
    expect(mockEnqueueMutation).not.toHaveBeenCalled();
  });
});
