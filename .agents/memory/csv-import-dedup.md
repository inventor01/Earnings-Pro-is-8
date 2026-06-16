---
name: CSV import duplicate prevention
description: How/why the /entries/import endpoint dedupes, and the deliberate manual-entry exception
---

# CSV import duplicate prevention

`POST /api/entries/import` (backend/routers/entries.py `import_entries`) dedupes
re-imported rows **only by a non-empty `order_id`**, scoped to `current_user`:
it preloads the user's existing non-empty order_ids and also tracks a per-batch
`seen_order_ids` set, skipping matches and returning `skipped_duplicates` in the
response.

**Why:** Platform CSVs (Uber/DoorDash) carry a stable per-order id, so re-importing
the same file would otherwise create duplicate rows. Rows **without** an order_id
(e.g. manually-logged entries, and possibly our own CSV export if it omits order_id)
are intentionally **NOT** deduped — two legitimately-identical manual entries
($5 tip, same minute) must both survive. So "duplicate handling" is order_id-based,
not tuple/timestamp-based.

**How to apply:** If a user reports re-imported manual entries duplicating, that's
expected unless the CSV carries order_ids. If you ever want manual-entry dedup, do it
deliberately (tuple key) and accept the false-positive risk. Backend change → NOT OTA;
it ships with a backend deploy, not `eas update`.
