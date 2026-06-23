---
name: Edit/delete 404 from STALE positive ids (not just negative optimistic ids)
description: PUT/DELETE /entries can 404 with a real positive id when the cached row was deleted elsewhere; handle as a resync, not a hard error
---

# Entry edit/delete 404s have TWO causes, not one

`PUT /api/entries/{id}` (and DELETE) 404 "Entry not found" at the id+user_id
lookup BEFORE any field/date-time processing. So the failing field (e.g.
"editing date/time") is irrelevant — the id just isn't on the server.

Two distinct sources:
1. **Negative/optimistic id (id<=0)** — offline-queued or not-yet-persisted
   create rows (`synthesizeEntry` makes negative ids). Guarded in handleSave
   (`editing.id <= 0` → "Still saving"); delete drops it from the queue.
2. **Stale POSITIVE id** — the row WAS real but was removed from the server
   afterward (deleted on another device, or cleaned up during a platform sync)
   while still lingering in the local React Query cache. The id<=0 guard can't
   catch this. Synced Uber/Shipt orders carry real `Entry.id` PKs, and the
   offline drain never births a wrong positive id, so a positive-id 404 is
   always this stale-cache case.

**Rule:** treat a positive-id edit/delete 404 ("404" or "not found" in the
error) as a cache-divergence signal, not a hard error. Roll back the optimistic
patch, invalidate + `refetchQueries(['entries'])` so the phantom drops from
EVERY window, and show a plain "entry no longer exists, list refreshed" message
instead of raw 404 JSON.

**Why:** a positive-id 404 means the client cache diverged from server truth;
the only correct recovery is to resync. Surfacing the raw JSON looked like a
crash and left the user stuck unable to edit a row that shouldn't be there.

**How to apply:** all entry-list query keys are prefixed `['entries', ...]`
(TODAY / period tf / 'nav' / 'custom'), so a single prefix-matched
invalidate/refetch reaches every cached window — including past-day views.
