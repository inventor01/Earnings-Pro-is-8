---
name: Never cancelQueries on data-less windows
description: Why optimistic-mutation onMutate must only cancel in-flight fetches for queries that already hold data, or the dashboard can stick on its loading skeleton.
---

# cancelQueries must skip data-less (first-fetch) queries

**Rule:** in an optimistic mutation's `onMutate`, cancel in-flight fetches ONLY
for cached windows that already hold data — e.g.
`cancelQueries({ queryKey, predicate: q => q.state.data !== undefined })`.
Pair it with a heal in any success path that intentionally skips invalidation:
`refetchQueries({ queryKey, type: 'active', predicate: q => q.state.data === undefined })`.

**Why:** cancelling a window's FIRST fetch (no cached data — right after a cold
start or after swiping to a fresh period) leaves the query pending/data-less
forever. The dashboard renders its skeleton while the active rollup query is
data-less-pending, so the screen looks "cleared." Normally the onSuccess
invalidation restarts the fetch, but the queued-offline create path (synthetic
negative id) deliberately SKIPS invalidation to protect the optimistic patch —
so nothing ever refetched the window until a period-chip tap changed the query
key. Symptom: "dashboard clears sometimes after adding an entry until you click
the Today tab."

**How to apply:** cancelling exists only to stop a landing response from
stomping an optimistic patch — and the optimistic patch loops skip windows with
`old === undefined`, so a data-less window has nothing to protect. Cancelling it
is pure downside. Mutations whose success path ALWAYS invalidates (edit/delete)
self-heal and don't strictly need the predicate, but any path that skips
invalidation (offline queue) must never leave a cancelled first fetch behind.
