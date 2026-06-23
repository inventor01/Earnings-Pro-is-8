---
name: Entry timestamps are EST-canonical end to end
description: All entry time/date DISPLAY and optimistic timestamps must use US/Eastern + minute precision to match the EST-based backend
---

# Entry timestamps are EST-canonical end to end

The app is Eastern-Time-canonical everywhere that matters: the add/edit modal
shows EST, the Today/Yesterday/week/month windows bucket by EST, and the backend
stores entry timestamps by localizing the EST wall-clock `date`+`time` to UTC.

**Rule 1 — DISPLAY in EST.** Any `toLocaleTimeString`/`toLocaleDateString` that
renders an ENTRY timestamp must pass `timeZone: 'America/New_York'`. Omitting it
renders in the device's local zone, so a non-Eastern driver sees a list time
shifted from what they typed (modal) and from the day the entry is counted under.

**Why:** display, entry input, and day-bucketing must agree. A Central-time
device showed an entry typed as 1:30 PM EST as "12:30 PM" in the list while the
modal said 1:30 PM and the rollup counted it under the EST day.

# Optimistic timestamps must be MINUTE-precise (match the server)

The backend stores only HH:MM (the EST→UTC helper drops seconds). Optimistic
create/edit rows must therefore minute-truncate their timestamp:
`new Date(Math.floor(entryDate.getTime() / 60000) * 60000).toISOString()`.

**Why:** building the optimistic instant from the exact `entryDate` left
sub-minute seconds, so the row sorted to a slightly different position than the
minute-quantized server row — the entry visibly jumped to its "right spot" only
after a refetch/app reopen. EST↔UTC offsets are whole minutes, so minute
truncation makes the optimistic instant byte-identical to the stored one.

**How to apply:** applies to BOTH the create optimistic insert and the edit
path's recomputed timestamp. Backend list order is `timestamp DESC, id DESC`.
