---
name: Optimistic rollup patches must be window-scoped
description: Why entry add/edit optimistic ['rollup'] patches must use keyWindowContainsDate per cache key instead of a single net delta applied to all windows.
---

# Optimistic ['rollup'] patches must be scoped per window

Both the CREATE and EDIT entry flows optimistically patch every cached
`['rollup', ...]` window so the dashboard KPI/profit number updates before the
server round-trip. The correct way to do this is to iterate each cached key and
test membership with `keyWindowContainsDate(key, estDate)` — NOT to apply one
net delta to every window.

**Rule:** for an EDIT that may change the entry's date/time, compute the row's
OLD est day (`easternDateTime(parseServerDate(oldEntry.timestamp)).date`) and NEW
est day (`patch.date`). Per cached rollup key:
- window contains BOTH old & new day → apply the net delta (new − old)
- window contains OLD only (row left it) → subtract the row's FULL old contribution
- window contains NEW only (row entered it) → add the row's FULL new contribution
- window contains NEITHER → no-op

**Why:** a pure date move leaves the amount unchanged, so a single net delta is 0
for EVERY window. Applying that 0 to the currently-viewed window left its number
unchanged optimistically, and the displayed number then only corrected after a
cold app restart (the onSuccess invalidate→refetch reconcile did not visibly
update the active window's NUMBER for this case). Create/delete flows masked the
problem because their optimistic delta already equals the eventual server value,
so a weak reconcile was invisible there — a date-move edit is the only case where
the number must come entirely from the optimistic patch being correct.

**How to apply:** keep `invalidateEntryData(queryClient)` in onSuccess as the
final server-truth reconcile, but never rely on it to produce the *visible*
number change — make the optimistic patch itself correct via per-window scoping.
The entries-list patch reconciles fine via refetch and was left as-is.

**CREATE flow must also be window-scoped for ALL dates, not today-only.** The
create onMutate previously gated its rollup/KPI patch behind `if (isToday)`,
patching KPIs only for today's entries while its entries-list patch was already
window-scoped for any date. Result: a BACKDATED new entry (or one added while
viewing a navigated day/week/month) updated History but NOT the KPI cards /
Profit Hero / Goal bar. **Why it surfaced as "doesn't show until I reopen":** a
queued/offline create deliberately SKIPS the onSuccess invalidate (so it doesn't
wipe the optimistic patch with stale server data), so the only thing that fixes
the KPI number for a non-today create is a cold restart refetch. Fix = drop the
`isToday` gate and patch every cached `['rollup']` key filtered by
`keyWindowContainsDate(key, estDateStr)` — adding the entry's magnitude to a
CONTAINING window's totals is correct regardless of which day inside the window
it falls on, and the scoping prevents inflating non-containing windows. This
makes create consistent with the edit flow.

Update: keyWindowContainsDate + the create rollup reducer are now extracted into
`earnings-ninja-expo/lib/rollupWindow.ts` (pure, like lib/goalOptimistic.ts) and
guarded by `__tests__/rollupWindow.test.ts`. Both take an optional `base` (EST
today) param ONLY for deterministic tests; production omits it. Any future
date-window/KPI refactor should keep that test green.
