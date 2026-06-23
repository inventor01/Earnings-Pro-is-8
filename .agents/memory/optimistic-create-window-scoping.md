---
name: Optimistic create must be scoped to matching day-windows
description: Why the create mutation's optimistic insert must only target cache windows whose date range contains the entry, not every window.
---

# Optimistic create / rollup patches must be scoped to windows that contain the entry's date

The dashboard caches many per-window React-Query slots keyed by date range
(`['entries'|'rollup', 'custom', from, to]` | `[..., tf, 'nav', from, to]` |
`[..., label, offset]`). The Add-Entry mutation's `onMutate` used to optimistically
write the new row / KPI delta into **every** cached window, relying on the
`onSuccess` invalidation to refetch and drop it from non-matching windows.

**The trap:** `onSuccess` deliberately SKIPS reconciliation when the entry was not
persisted (negative synthetic id = queued offline because the POST failed/timed
out, e.g. backend cold-start). With no reconciliation, the optimistic row stays
in every day-window forever → "a new entry shows up on every day."

**Rule:** scope optimistic create/rollup writes at insert time to only the
windows whose date range actually contains the entry's EST date. Do not rely on a
later invalidation to clean up, because the offline-queue path never invalidates.

**Why:** correctness must not depend on a network round-trip succeeding; offline
queued entries get no server reconciliation.

**How to apply:** a pure predicate (membership of an EST date in a window key) is
shared by both the `['entries']` and `['rollup']` loops. EST date = the date the
user picked, defaulting to EST today. Non-zero aggregate offsets are always
`'nav'`-keyed and single days are `'TODAY'`-keyed, so the label branches can
treat offset-0 live semantics (`THIS_WEEK`=Mon..today, `THIS_MONTH`=1st..today).
Server-side day filtering is independently correct — this is purely a frontend
optimistic-cache scoping concern.
