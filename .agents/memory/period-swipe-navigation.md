---
name: Period swipe navigation (Earnings Ninja dashboard)
description: How dashboard swipe/chevron time-period navigation is built frontend-only against the deployed backend, and the EST/goal invariants it must preserve.
---

# Dashboard period swipe navigation

The dashboard (`earnings-ninja-expo/app/(tabs)/index.tsx`) lets users swipe/chevron
to navigate time windows from ANY period chip (not just Today). A single signed
`navOffset` (0 = live window) steps by the chip's natural unit.

## Hard constraint: frontend-only, deployed backend
**Why:** the mobile app hits the DEPLOYED backend (production `API_BASE` fallback in
`lib/api.ts`), and ships via OTA (`eas update`). Backend edits do NOT reach the app
via OTA. So any period-navigation feature MUST be built using only already-deployed
endpoints:
- `getRollup(tf, day_offset)` / `getEntries(tf, limit, day_offset)` — **`day_offset`
  is honored ONLY for the `TODAY` timeframe** (see `backend/routers/rollup.py`).
- `getRollupInRange(from, to)` / `getEntriesInRange(from, to)` — arbitrary inclusive
  **EST** `YYYY-MM-DD` bounds.

## The stepping model
- Day-periods (today/yesterday) step by DAYS via `TODAY` + `day_offset`: today →
  `navOffset`; yesterday → `navOffset - 1` (yesterday's live window is already -1).
- Aggregate periods (week/last7/month/lastMonth) step by full week / calendar month,
  computed client-side as EST ranges (`navRangeFor()`), queried via the range fns.
  **At offset 0 they keep the timeframe path** so the live partial-to-date window
  (e.g. "This Week" = Mon..today) and its goal stay byte-identical to old behavior.

## EST math invariant
`navRangeFor` must mirror `backend/services/period.py`: week starts **Monday**;
THIS_WEEK/THIS_MONTH are partial (…→today) only at offset 0; navigated weeks are full
Mon..Sun; navigated months are full 1st..last. Do calendar math on a **UTC-anchored
Date** seeded from EST "today" (`estTodayUTC` via `toLocaleDateString('en-CA',
{timeZone:'America/New_York'})`) so it's device-tz-independent and DST-safe.

## Cache-key invariant (don't break optimistic add/delete)
The optimistic add/delete plumbing patches the **currently active** `rollupKey` /
`entriesKey`. Keep the default today key `['rollup','TODAY',0]` unchanged, and give
each navigated window a distinct key (`['rollup',tf,'nav',from,to]`). Broad
invalidation of the `['rollup']`/`['entries']`/`['goal']` prefixes covers the new keys.

## Goal consistency
Day-periods share the **single daily `TODAY` goal** via `goalTf = isDayPeriod ?
'TODAY' : tf`, used for BOTH the goal read query and the upsert mutation.
**Why:** only TODAY/THIS_WEEK/THIS_MONTH goal rows exist; without this the Yesterday
chip shows no goal bar while Today-swiped-back-one-day does — same day, inconsistent
UI. Routing both read+edit through `goalTf` keeps them in lockstep (don't split them
or "Edit Goal" writes a key nobody reads).

## Known, accepted limitation
`ProfitChart` day-bucketing and the `dateLabelForOffset` label use device-local
`new Date()` (pre-existing across ALL periods, not introduced here). Relative words
("Yesterday"/"Tomorrow") stay correct; only the date string can be off-by-one near
midnight on non-ET devices. Converting all bucketing to EST is a separate, riskier
refactor — out of scope for the swipe fix.

## Swipe/chevron ↔ period-chip sync (Today/Yesterday)
`goToOffset` syncs the highlighted chip to the day actually shown for DAY-periods:
it steps a canonical day offset (0=today, -1=yesterday, …) held in `dayOffsetRef`
(stepped synchronously so rapid taps don't drop to a stale closure; re-synced via
effect after each commit, which also covers chip taps), then re-derives the chip —
`>=0` → `today`/navOffset=offset, `<0` → `yesterday`/navOffset=offset+1. So
Today↔Yesterday track the viewed day, monotonic across the boundary both ways, and
the derived `day_offset` (cache key + daily goal) is identical via either chip.

**Why aggregate periods were NOT chip-synced:** week/last7 have no sibling chip for
their offset windows. month↔lastMonth *would* map cleanly (month@-1 ≈ lastMonth@0),
but goals only exist for TODAY/THIS_WEEK/THIS_MONTH — `goalTf='LAST_MONTH'` has no
settable goal, so switching the chip there would drop the goal bar. Left as
navOffset-only (header shows the exact range) to avoid that regression.

## Display-only chip highlight while swiping through days (decoupled from data)
When swiping through individual DAYS, the highlighted tab now acts as a "how far back
am I" indicator and moves Today → Yesterday → This Week → This Month — but the
dashboard keeps showing that **single day's** numbers. This is done by a render-only
`displayChip = isDayPeriod ? dayOffsetToChip(effectiveDayOffset) : period`, used ONLY
for the period-tab `active` styling. `period` stays `today`/`yesterday` during day
swipes, so data fetch, cache keys, `goalTf` (daily goal), and the header `periodLabel`
(which still shows the exact single-day date) are all UNCHANGED.
**Why:** user wants the tab to reflect position in time without switching to the
week/month aggregate. `dayOffsetToChip` maps by **EST calendar** (mirrors `estTodayUTC`
/ Monday-start week): 0→today, exactly −1→yesterday, earlier-but-still-in-current-week
→week, earlier-but-in-current-month→month, anything older clamps to month (furthest
indicator chip; LastMonth deliberately not used as an indicator).
**How to apply:** never route the swipe highlight back through `setPeriod('week'/'month')`
— that would switch the DATA to the aggregate. Keep highlight (displayChip) and data
(`period`) separate. Tapping a highlighted week/month chip still calls `setPeriod` →
real aggregate, as before.
