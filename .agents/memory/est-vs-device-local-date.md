---
name: EST vs device-local date in the Expo app
description: All day-bucketing in Earnings Ninja is US/Eastern; any "is this today?" comparison must use EST, never the device-local clock.
---

# Day-logic in the app is US/Eastern — never compare against device-local date

Earnings Ninja anchors EVERY day boundary to US/Eastern (write path projects EST
wall-clock via `easternDateTime`; backend buckets TODAY/WEEK/MONTH on EST→UTC
bounds). Entry payloads carry an EST `date` string, not a device-local one.

**Rule:** any client-side day comparison ("is this entry for today?", which window
contains it, etc.) must derive "today" in EST (`fmtUTCDate(estTodayUTC())`), NOT from
`new Date().getFullYear()/getMonth()/getDate()`.

**Why:** the create mutation's optimistic KPI tick gated on `isToday` by comparing
the EST `vars.date` against a DEVICE-LOCAL todayStr. For users west of Eastern late
in the evening (e.g. 9pm PT = 12am ET next day) the two disagree, so a genuinely
today-EST entry looked backdated → optimistic dashboard tick skipped → cards only
updated after the server round-trip (or, if offline-queued, not until the next
foreground drain = "the entry didn't show until I reopened the app").

**How to apply:** reuse the module-level `estTodayUTC()` + `fmtUTCDate()` helpers
already in `app/(tabs)/index.tsx`; the window-membership predicate
`keyWindowContainsDate(key, estDate)` is the other EST-correct primitive.
