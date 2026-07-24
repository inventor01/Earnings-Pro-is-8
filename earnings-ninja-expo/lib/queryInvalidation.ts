import type { QueryClient } from '@tanstack/react-query';

// Single source of truth for "entry data changed" cache invalidation.
//
// Every code path that creates / edits / deletes / imports / drains an entry
// must converge the same spread of React-Query keys, otherwise some surface
// silently serves stale numbers (the global staleTime is 30s). Invalidation is
// PREFIX-based, so invalidating ['rollup'] / ['entries'] does NOT match the
// Analytics modal's separate ['analytics-rollup'] / ['analytics-entries']
// namespace — those have to be listed explicitly. Centralizing the list here
// means a new entry-mutation path only has to call invalidateEntryData() and
// can never drift out of sync with the others.
//
// See .agents/memory/analytics-cache-invalidation.md for the history of the
// "doesn't update instantly" bugs this prevents.
const ENTRY_DATA_KEYS: readonly (readonly [string])[] = [
  ['entries'],
  ['rollup'],
  ['goal'],
  ['entries-range'],
  ['analytics-rollup'],
  ['analytics-entries'],
];

export function invalidateEntryData(queryClient: QueryClient): void {
  for (const queryKey of ENTRY_DATA_KEYS) {
    queryClient.invalidateQueries({ queryKey });
  }
}

// Predicate for cancelQueries: ONLY cancel in-flight fetches for queries that
// already HOLD data. Those are the only ones an optimistic patch could be
// stomped on by an incoming response. Cancelling a query's FIRST fetch (no
// data yet — right after a cold start, a swipe to a fresh period, or after
// cache eviction) strands it: it sits `pending` with no data forever when the
// mutation resolves through the offline queue (synthetic success paths skip
// the invalidation that would restart it) or errors (onError "restores" an
// undefined snapshot, which does not restart the fetch). The stranded screen
// then renders EMPTY until a full app restart recreates the QueryClient.
// See .agents/memory/cancelqueries-dataless-skeleton.md — every optimistic
// onMutate cancel in the app must go through this guard.
export const queryHasData = (q: { state: { data?: unknown } }): boolean =>
  q.state.data !== undefined;

// Guarded cancel used by every optimistic-mutation onMutate.
export async function cancelQueriesWithData(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: queryKey as unknown[], predicate: queryHasData });
}
