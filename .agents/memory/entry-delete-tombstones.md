---
name: Entry-delete tombstones
description: Deleted entries flickering back — tombstone recently-deleted ids and filter BEFORE every mirror write and offline read
---
A GET already in flight when a DELETE lands can resolve after the optimistic removal and re-insert the row. Fix: short-TTL (60s) in-memory tombstone set of deleted ids, marked on every delete outcome (confirmed, 404, queued, synthetic-id).

**Why:** filtering only the returned list is not enough — the stale response had already been persisted into the local mirror (`mergeServerEntries` / `replaceServerEntries`), so the row resurrected in offline reads and after the TTL. Architect review caught this.

**How to apply:** strip tombstoned rows BEFORE any mirror write and on the offline fallback paths too (timeframe, range, and full-pull reads). Any new entries-read path in lib/api.ts must go through `dropTombstoned`.
