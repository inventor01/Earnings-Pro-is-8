---
name: Optimistic delete → rollup/goal-bar reset
description: How (and why) deleting entries optimistically patches the rollup cache so the dashboard goal bar + KPIs reset instantly, without corrupting other period windows.
---

# Optimistic delete patching of the rollup cache

The dashboard goal-progress bar is derived locally from `rollup.profit`
(`rawGoalPct = profit / target`, `isGoalLoss = target>0 && profit<0`). So any
mutation that changes profit must patch the cached rollup to update the bar
without waiting for a refetch — invalidate-only feels stale on slow/cold-start
networks.

## Rules for optimistic rollup patches on delete

- **Patch only the ACTIVE `rollupKey`, never `setQueriesData(['rollup'])`.**
  **Why:** one global delta applied to every cached window (TODAY/WEEK/MONTH/
  dayOffset/custom) writes wrong numbers into windows that don't contain the
  deleted rows, which transiently corrupts them if the user switches periods
  before reconcile. Snapshot ALL caches for rollback, but mutate only the active
  one.
  **How to apply:** `getQueryData(entriesKey)` to find the deleted rows; if none
  match (e.g. a calendar delete of an out-of-period row) leave the rollup alone
  and let the reconcile refetch handle it — recomputing from the 200-row-capped
  entries cache would introduce drift.

- **`average_order_value` must be recomputed from ORDER-type entries only.**
  **Why:** backend (`backend/services/rollup_service.py`) defines it as
  `sum(amount where type=='ORDER') / count(type=='ORDER')` — BONUS rows have
  positive amounts but are NOT orders. Omitting this leaves the KPI stale; using
  all positive rows overcounts.

- **Amount is SIGNED; key the revenue/expense split off the sign, not the type.**
  `amount >= 0` reduces revenue, `amount < 0` reduces expenses; `profit =
  revenue - expenses`. Mirrors the backend and the Add-Entry optimistic patch.

- **`$/hr` is left as a `profit/hours` approximation, reconciled by refetch.**
  **Why:** backend computes it from the first→last timestamp span with special
  sub-1h handling, which the client can't reproduce from cached entries. The
  Add-Entry optimistic patch already uses `profit/hours`; staying consistent is
  better than leaving it stale. Reconcile (`invalidateQueries`) fixes it ~200ms
  later. The goal bar doesn't depend on it.

- **Always reconcile after a delete:** invalidate `['entries']`,`['rollup']`,
  `['goal']`,`['entries-range']`. On partial bulk failure the reconcile refetch
  brings surviving rows (and their KPI contribution) back.

## Note: delete vs create offline-queue asymmetry

`api.deleteEntry` throws on failure (does NOT route to the offline queue), so —
unlike `api.createEntry` — it's safe to invalidate on success without the
"synthetic negative-id / don't invalidate when merely queued" guard that the
Add-Entry path needs. See `optimistic-update-offline-queue.md`.
