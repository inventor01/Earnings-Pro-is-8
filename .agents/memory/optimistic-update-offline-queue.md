---
name: Optimistic update vs offline queue (KPI snap-back)
description: Why add-entry KPIs ticked up then reverted, and the rule that fixes it — never invalidate after a merely-queued write.
---

# Add-entry KPI "updates then reverts" bug

**Symptom:** After adding an entry, the dashboard number updated for a second then snapped back to the old value; it only stuck after closing and reopening the app.

**Mechanism:** `api.createEntry` (mobile) swallows TRANSIENT POST failures (no status / 401 / 408 / 429 / 5xx — common on flaky mobile networks while driving), enqueues the entry to the offline queue, and returns a SYNTHETIC entry with a NEGATIVE id. Because it resolves, the React Query mutation's `onSuccess` fires and used to invalidate `['rollup']`/`['entries']`/`['goal']` unconditionally. The refetch hits a server that does NOT have the entry yet (only queued) → the optimistic patch is wiped → revert. The offline queue drains on app foreground (`AppState === 'active'` in `app/_layout.tsx`), which re-invalidates — that's why reopening shows the correct number.

**Rule / fix:** In a mutation `onSuccess`, only reconcile with the server (invalidate) when the write was ACTUALLY persisted. The reliable signal here: server rows have positive DB ids; queued/synthetic entries are negative by construction (`synthesizeEntry`). Guard: `const persisted = typeof data?.id === 'number' && data.id > 0;` — invalidate only when `persisted`, otherwise keep the optimistic state and let the foreground drain reconcile.

**Why:** Invalidating after a write that only landed in an offline queue refetches stale server state and destroys the optimistic UI. Any "fire-and-forget / queue on failure but still resolve" path must NOT trigger a server refetch until the write truly lands.

**Ruled out (don't re-chase):** No server-side rollup caching; backend sets `Cache-Control: no-store` on all `/api`; Railway prod backend healthy (~330ms). Read-after-write race is impossible because `onSuccess` only fires after the POST resolves (commit done) in the non-queued path.

**Scope note:** `onMutate` patches `['rollup']` only for today's entries (window math is hard for backdated), but patches `['entries']` globally across all period caches. In the queued path (invalidation skipped) a backdated offline entry can linger in non-active period lists until the next foreground drain — accepted as offline best-effort, not worth rescoping.
