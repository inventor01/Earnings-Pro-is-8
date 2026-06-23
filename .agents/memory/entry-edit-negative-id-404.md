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
yesterday). `now + effectiveDayOffset*86_400_000` gives the viewed instant;
`easternDateTime` preserves the correct EST calendar date. Only for day-periods
viewing a past day — today/aggregate periods use live now (`undefined`).
