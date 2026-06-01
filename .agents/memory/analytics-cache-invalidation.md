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

**How to apply:** the entry-write paths live in `app/(tabs)/index.tsx`
(createEntry onSuccess — gate behind the `id > 0` / persisted check so
offline-queued synthetic entries don't snap back; updateMutation onSuccess;
ImportCsvRow onDone; the shared `reconcileAfterDelete` callback) and the
offline-queue drain in `app/_layout.tsx`. If you add a NEW entry-mutation path,
add the two analytics invalidations there too. Consider centralizing all
"entry data changed" invalidations into one helper to prevent future key drift.
