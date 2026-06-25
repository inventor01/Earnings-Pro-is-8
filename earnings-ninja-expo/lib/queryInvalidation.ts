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
