---
name: Analytics modal cache invalidation
description: The Analytics modal uses a separate React-Query key namespace; entry mutations must invalidate it explicitly or stale data shows for up to staleTime.
---

# Analytics modal is a separate React-Query namespace

The dashboard/history use `['rollup', ...]` and `['entries', ...]`. The Analytics
modal uses DIFFERENT keys: `['analytics-rollup', period, dayStamp]` and
`['analytics-entries', period, dayStamp]` (its queries are `enabled: visible`).

**Rule:** every code path that creates / edits / deletes / imports / drains an
entry MUST also invalidate `['analytics-rollup']` and `['analytics-entries']`,
in addition to the usual `['rollup']`/`['entries']`/`['goal']`/`['entries-range']`.

**Why:** React-Query invalidation is prefix-based, so invalidating `['rollup']`
or `['entries']` does NOT match the `analytics-*` keys. The global QueryClient
`staleTime` is 30s (`app/_layout.tsx`), so without explicit analytics
invalidation, reopening Analytics within 30s of a change serves stale cache and
silently omits the just-added/deleted entry — a "doesn't update instantly" bug.

**How to apply:** this is now CENTRALIZED — call `invalidateEntryData(queryClient)`
from `lib/queryInvalidation.ts` (the single source of truth for the full key
spread incl. the analytics namespace) from any add/edit/delete/import/drain path.
Do NOT hand-roll the per-key `invalidateQueries` list again; just call the helper.
Existing callers: createEntry on{Success,Error}, updateMutation on{Success,Error},
ImportCsvRow onDone, `reconcileAfterDelete` (delete/bulk/calendar) in
`app/(tabs)/index.tsx`, and the offline-queue drain in `app/_layout.tsx`.
The `['analytics-rollup']`/`['analytics-entries']` literals should now ONLY
appear in the helper and in the Analytics modal's query definitions (the reads),
never in a fresh invalidation block. Goal-only mutations and manual pull-to-
refresh deliberately stay separate (they don't mutate entry data).
