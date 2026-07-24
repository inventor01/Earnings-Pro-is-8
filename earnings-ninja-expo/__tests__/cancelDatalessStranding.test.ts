/**
 * Regression test for the "app appears empty until full restart" bug.
 *
 * Root cause: optimistic-mutation onMutate handlers called
 * queryClient.cancelQueries() on the ['entries'] / ['rollup'] / ['goal']
 * namespaces WITHOUT excluding queries that have no data yet. Cancelling a
 * query's FIRST fetch (right after cold start / fast navigation to a fresh
 * period) leaves it `pending` with data undefined and fetchStatus idle —
 * and when the mutation resolves through the offline queue (synthetic
 * success skips invalidation) or errors (onError restores an `undefined`
 * snapshot), nothing ever restarts that fetch. The screen renders empty
 * until an app restart recreates the QueryClient.
 *
 * The fix: every onMutate cancel goes through cancelQueriesWithData(), which
 * only cancels queries that already hold data.
 */
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { cancelQueriesWithData, queryHasData } from '../lib/queryInvalidation';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('cancelQueriesWithData (data-less stranding guard)', () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false, networkMode: 'always', staleTime: 30_000 } },
    });
  });
  afterEach(() => qc.clear());

  test('UNGUARDED cancel strands a first fetch: pending, no data, not fetching (the bug)', async () => {
    const d = deferred<string[]>();
    const observer = new QueryObserver(qc, { queryKey: ['entries', 'TODAY'], queryFn: () => d.promise });
    const unsub = observer.subscribe(() => {});
    await tick();
    expect(observer.getCurrentResult().isFetching).toBe(true);

    // The pre-fix behavior: cancel EVERYTHING under the prefix.
    await qc.cancelQueries({ queryKey: ['entries'] });
    d.resolve(['row']); // late response must not land after a cancel
    await tick();

    const res = observer.getCurrentResult();
    // Stranded: no data, not fetching, still pending -> renders empty forever.
    expect(res.data).toBeUndefined();
    expect(res.isFetching).toBe(false);
    expect(res.status).toBe('pending');
    unsub();
  });

  test('guarded cancel lets a data-less first fetch complete (the fix)', async () => {
    const d = deferred<string[]>();
    const observer = new QueryObserver(qc, { queryKey: ['entries', 'TODAY'], queryFn: () => d.promise });
    const unsub = observer.subscribe(() => {});
    await tick();

    await cancelQueriesWithData(qc, ['entries']); // must NOT cancel: no data yet
    d.resolve(['row']);
    await tick();

    const res = observer.getCurrentResult();
    expect(res.status).toBe('success');
    expect(res.data).toEqual(['row']);
    unsub();
  });

  test('guarded cancel DOES cancel an in-flight refetch of a query that holds data', async () => {
    let call = 0;
    const second = deferred<string[]>();
    const observer = new QueryObserver(qc, {
      queryKey: ['rollup', 'TODAY'],
      queryFn: () => (++call === 1 ? Promise.resolve(['v1']) : second.promise),
    });
    const unsub = observer.subscribe(() => {});
    await tick();
    expect(observer.getCurrentResult().data).toEqual(['v1']);

    // Refetch in flight over existing data — this is the case the cancel is FOR
    // (an optimistic patch must not be stomped by the in-flight response).
    void observer.refetch();
    await tick();
    expect(observer.getCurrentResult().isFetching).toBe(true);

    await cancelQueriesWithData(qc, ['rollup']);
    qc.setQueryData(['rollup', 'TODAY'], ['optimistic']);
    second.resolve(['stale-server']);
    await tick();

    // Optimistic value survives; the cancelled response never lands.
    expect(qc.getQueryData(['rollup', 'TODAY'])).toEqual(['optimistic']);
    unsub();
  });

  test('queryHasData predicate', () => {
    expect(queryHasData({ state: { data: undefined } })).toBe(false);
    expect(queryHasData({ state: { data: [] } })).toBe(true);
    expect(queryHasData({ state: { data: null } })).toBe(true);
    expect(queryHasData({ state: {} })).toBe(false);
  });
});
