---
name: Offline local source-of-truth (mobile)
description: How the Expo app serves cold-start offline reads for ANY period, not just previously-viewed windows.
---

# Offline reads = local computation, not just React Query cache

React-Query cache-persistence alone only covers windows the user already viewed,
so cold-start offline reads of an un-viewed period return nothing. The fix is a
**local source-of-truth** the read APIs fall back to.

**Pattern (mirrors the createEntry→enqueue write pattern):** each read API
(`getRollup`/`getRollupInRange`/`getEntries`/`getEntriesInRange`/`getGoal`)
wraps only the `trackedFetch` in try/catch. On a **thrown network error** it
returns a locally-computed result; a **non-2xx still throws** (don't mask auth/
server errors with local data). On success it mirrors the server rows into the
local store.

**Layers:**
- `lib/estRange.ts` — pure EST date math mirroring backend `period.py`
  (`rangeForTimeframe`/`rangeForDates` → absolute UTC ms bounds). Holds `parseUTC`
  so `localStore` needs only TYPE imports from `api` (avoids an api↔localStore
  runtime cycle — api runtime-imports localStore, localStore imports api types only).
- `lib/localStore.ts` — AsyncStorage mirror of server entries + per-timeframe goal
  cache. Offline reads aggregate the mirror **with the pending queues overlaid**:
  queued creates added (negative ids), queued edits applied, queued deletes removed.
  `aggregate()` mirrors backend `rollup_service.py`.
- Mirror maintenance: window fetches `merge` (upsert by positive id, never delete);
  a periodic authoritative full pull (`api.getAllEntries`, wide date range) `replace`s
  the mirror so server-side deletions propagate.

**Reconcile = server-wins LWW:** `_layout` `tryDrain` drains both queues FIRST,
then runs `getAllEntries()` (best-effort, skipped offline, no live-query invalidate
since RQ already refetches on focus). Draining before pulling means the server
already has our queued writes before we overwrite the mirror.

**Why:** the prior phase (cache-persistence only) was code-review-rejected for not
covering cold-start offline reads of arbitrary periods.

**How to apply:** any new read endpoint that must work offline needs a matching
`local*` computation in `localStore` + the same network-only fallback wrapper; keep
all RMW on the store (entries AND goals) behind `withStoreLock`.
