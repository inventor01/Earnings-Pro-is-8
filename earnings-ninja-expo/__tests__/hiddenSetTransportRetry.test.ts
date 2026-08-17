// Regression: the Android "first hide/show attempt fails with Network Error,
// second works" bug. Root cause: a stale kept-alive socket makes the FIRST
// fetch THROW (transport failure, no HTTP response); a fresh attempt succeeds.
// The hidden-set endpoints are wholesale-replace (idempotent), so api.ts
// re-sends exactly once on a thrown fetch — and NEVER on an HTTP error status.

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
jest.mock('../lib/syncTrigger', () => ({
  requestDrain: jest.fn(),
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
jest.mock('../lib/demoSession', () => ({
  isDemoActive: jest.fn(() => false),
}));

import { api } from '../lib/api';

const okJson = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body } as unknown as Response);

describe('hidden-set idempotent transport retry', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.clearAllMocks();
  });

  it('retries ONCE when the first fetch throws, and succeeds', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(okJson(['DOORDASH']));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await api.setHiddenPlatforms(['DOORDASH']);
    expect(result).toEqual(['DOORDASH']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Same request both times (idempotent whole-set PUT).
    expect(fetchMock.mock.calls[0][0]).toBe(fetchMock.mock.calls[1][0]);
    expect(fetchMock.mock.calls[0][1]?.body).toBe(fetchMock.mock.calls[1][1]?.body);
  });

  it('does NOT retry an HTTP error response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'bad keys' }),
      text: async () => JSON.stringify({ detail: 'bad keys' }),
    } as unknown as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(api.setHiddenPlatforms(['NOPE'])).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces the error when both attempts throw (real outage)', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new TypeError('Network request failed'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(api.setHiddenPlatforms(['DOORDASH'])).rejects.toThrow(
      'Network request failed',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry an AbortError', async () => {
    const abort = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    const fetchMock = jest.fn().mockRejectedValue(abort);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(api.setHiddenEntryTypes([])).rejects.toThrow('Aborted');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
