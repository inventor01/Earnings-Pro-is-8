---
name: Entry list ordering across mutation paths
description: All optimistic entry mutations (create/edit/delete) must sort with parseServerDate, and optimistic timestamps must be UTC-consistent with the server.
---

# Entry list newest-first ordering

The History list (`earnings-ninja-expo/app/(tabs)/index.tsx`) renders a sorted,
optimistically-mutated entries cache. Three mutation paths write to the
`['entries']` caches: create, edit, delete. They MUST stay consistent or an
entry shows up in the wrong position until an app restart refetches server data.

## Rule
- Every optimistic sort over entries must compare **`parseServerDate(ts).getTime()`**
  (newest first), never raw string comparison.
- Every optimistic timestamp must be the **same instant the server will store**.

**Why:** timestamps come in mixed formats — the server returns naive UTC
(tz-less, FastAPI strips tzinfo via `replace(tzinfo=None)`), while optimistic
rows use `Date.toISOString()` ('Z'-suffixed). `parseServerDate` normalizes both
(it appends 'Z' when missing). Raw string compare across these formats is
unreliable. A known failure mode hit BOTH counts at once: an optimistic timestamp
built as a **tz-less Eastern wall-clock** string (so parseServerDate read it
~4-5h off) AND a raw-string sort — an edited entry then jumped to the wrong spot
until restart. The create path uses the correct convention; mirror it everywhere.

**How to apply:** the backend localizes the EST `date`+`time` strings to UTC. On
the client, the AddEntryModal's `entryDate` (a JS Date) already holds the picked
instant, so `entryDate.toISOString()` is the correct optimistic timestamp for
BOTH create and edit. Reuse it; don't reconstruct tz-less strings from
`patch.date`/`patch.time`.

## Note on the real symptom vs. delivery
A "still broken in the app" report can mean the fix is in the tree but not yet on
the device. The create fix shipped in the JS tree but only lands once the
matching native build is installed + an OTA from the current tree is applied.
Verify with `git log`/`blame` whether the fix already exists before re-debugging.
