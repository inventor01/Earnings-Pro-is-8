---
name: Editing optimistic/offline rows 404s
description: Why entry edits sometimes hit "404 Entry not found" and how new-entry date defaults must follow the viewed day
---

# Editing not-yet-persisted entry rows → 404

Optimistic-create rows (`id: -Date.now()`) and offline-queued rows
(`id: -Math.floor(queuedAt/1000)`) are prepended to EVERY cached `['entries']`
list, including a past-day list the user is viewing. If the user taps edit on
such a row, `updateEntry(negativeId)` → `PUT /entries/{neg}` → server 404
"Entry not found".

**Rule:** any edit path must refuse rows with `id <= 0` (they don't exist
server-side yet). Guard at the edit entry points (list row + detail modal) AND
defensively in the save handler; show a "Still saving" message, never a raw 404.

**Why:** a negative id is the app's own synthetic placeholder, not a real PK.
It only becomes real after the create POST resolves / the offline queue drains.

# New-entry date must follow the viewed day

The Add modal seeds `entryDate` to live `now` on open. When the dashboard is
viewing a past day (Yesterday/N-back), a new entry must default to THAT day or
it lands under today and confuses the user (and tempts them to edit the
optimistic row → the 404 above). Pass the viewed day in as `defaultDate`.

**How to apply:** dashboard day offset is NEGATIVE for past days (`-1` =
yesterday). Compute the default by shifting the EST CALENDAR date, NOT the
absolute instant: `easternDateTime(now).date` → parse y/m/d →
`new Date(Date.UTC(y, m-1, d+offset, 16, 0, 0))`. 16:00 UTC = 11:00 EST / 12:00
EDT (mid-day either way) so `easternDateTime` always reports the intended EST
date. Only for day-periods viewing a past day — today/aggregate periods use live
now (`undefined`).

**Why not `now + offset*86_400_000`:** naive 24h subtraction drifts one day too
far near EST midnight on DST-transition days (the 23h spring-forward day gave
offset -1 = Mar 7 instead of Mar 8). Verified via deterministic Node tests
across spring-forward, fall-back, and month/year boundaries.
