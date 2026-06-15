---
name: Optimistic signed-amount must follow entry TYPE
description: Client optimistic rollup patches must re-derive amount sign from entry type, like the backend does.
---

# Optimistic signed-amount must follow entry TYPE

When optimistically patching dashboard rollups in the Expo app
(`earnings-ninja-expo/app/(tabs)/index.tsx`), derive the row's SIGNED amount
from the (possibly edited) entry **type**, not from the form's raw amount/mode:
`EXPENSE`/`CANCELLATION` → negative, everything else → positive, using
`abs(magnitude)`.

**Why:** The backend (`POST`/`PUT /entries` in `backend/routers/entries.py`)
ignores the incoming sign and normalizes by type. On a type-flip edit
(ORDER↔EXPENSE) the calculator's add/subtract mode can disagree with the new
type, so using `patch.amount` directly patches revenue vs. expense in the wrong
direction until the network refetch reconciles — visibly wrong KPIs.

**How to apply:** In any create/edit/delete optimistic handler, compute
`effType = patch.type ?? oldEntry.type` then sign `abs(amount)` by that type
before computing revenue/expense deltas. Edit flow also broadcasts the delta to
all `['rollup']` caches and reconciles via the onSuccess invalidate (same
accepted tradeoff as the create flow); always invalidate `['goal']` too so the
goal bar/target refreshes.

## Aggregations: use sign, not type, for inflow/outflow
When splitting entries into revenue vs expenses/outflow (e.g. Analytics daily
breakdown, expense trend), key off the **sign of `amount`** (`amt >= 0` = inflow,
`amt < 0` = outflow magnitude) — NOT `type === 'EXPENSE'`. A `CANCELLATION` is a
negative amount that is NOT type EXPENSE; type-based expense sums silently drop it
and break the invariant `net === revenue - expenses`. ORDER/BONUS are always
positive, EXPENSE/CANCELLATION always negative.
