---
name: History list multi-select pruning
description: Why the bulk-select pruning effect must key off the search-filtered visible set, not the raw period set
---

Multi-select on the History list (`app/(tabs)/index.tsx`) bulk-deletes whatever
ids are in `selectedIds`. A pruning `useEffect` keeps `selectedIds` in sync with
what's actually on screen.

**Rule:** that pruning effect must intersect `selectedIds` with the
**search-filtered** visible set (`filteredEntries`), not the raw period set
(`entries`). It must also live *below* `filteredEntries`/`sortedEntries` in the
component body so referencing it in the dependency array doesn't hit a TDZ error.

**Why:** selection composes with search + sort + calendar. If pruning keys off
the unfiltered period set, a user can select rows, then narrow the search, and
the now-hidden rows stay selected — bulk delete then removes entries the user
can't see. Sorting is *not* a dependency (it reorders, never changes membership).

**How to apply:** any future change to the History filters (new filter, new
search semantics) must re-check that the pruning effect's "visible set" still
matches what the list actually renders before enabling delete.
