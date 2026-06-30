---
name: Offline queue overlay on the ONLINE read path
description: Why successful entry/rollup reads must re-apply the pending offline queue (not just the failure path), and how replayed creates are deduped by idempotency_key.
---

# Pending-queue overlay belongs on the SUCCESS path, not only the catch path

**Rule:** Every authoritative server read of entries/rollups (the online success
path, not just the network-failure catch) must layer the still-pending offline
queue on top of the server data before returning it. In `lib/api.ts` all read
success paths call `overlayPendingOnEntries` / `overlayPendingOnRollup`
(`lib/localStore.ts`). Both are a strict no-op (return the same reference) when
the queue is empty, so the fully-online path is unchanged.

**Why:** A save that times out (Railway cold-start) is parked in the offline
queue with a negative synthetic id and shown optimistically. If the overlay only
runs on the failure path, any *successful* refetch — pull-to-refresh, app-focus,
or 30s staleTime expiry — overwrites the cache with a server set that doesn't yet
contain the queued row, ERASING the just-added entry until the foreground drain
on app reopen. (Create `onSuccess` deliberately skips invalidate for synthetic
ids, so there is no self-heal until drain.) This was the "pull-to-refresh erases
my new entry" bug.

**How to apply:**
- Server stays source of truth for EXISTENCE (a row deleted server-side is gone);
  only the user's own pending creates/edits/deletes are layered back in.
- Never re-filter an UNPATCHED server row against the window bounds — a tiny
  client/server bounds mismatch would otherwise drop a legitimate row. Only
  re-check `inRange` for rows a queued edit actually changed.
- Rollup overlay: subtract the OLD contribution (from the local mirror baseline)
  and add the new one for edits/deletes; pending creates are a pure addition. If
  there is no mirror baseline for an edited/deleted id, leave the server total
  alone (don't corrupt it). `average_order_value` can't be recomputed from the
  rollup response — keep the server value; it self-corrects on drain.

## Dedupe replayed creates by idempotency_key (avoid the transient duplicate)

**Rule:** When overlaying queued creates, skip any whose `idempotency_key`
already appears on a known server row (entries overlay: from `serverRows`; rollup
overlay: from the local mirror, which is refreshed on every successful
getEntries). The real row wins.

**Why:** A create can time out client-side yet still reach the server. The same
`idempotency_key` rides the first POST and the queued replay, so the backend
returns the original row instead of inserting a duplicate. Once that real row is
in a server read, also rendering the still-queued synthetic copy flashes a
duplicate list row / inflates KPIs until the queue drains. Deduping by the
echoed key is exact (no heuristic amount/time matching that could wrongly
suppress a genuine second identical entry).

**How to apply:** Requires the backend to serialize `idempotency_key` on the
entry response (`EntryResponse`) and the client `Entry` type + `synthFromCreate`
to carry it. Deploy ordering matters: ship the backend schema change (Railway)
BEFORE the client OTA — until the server echoes the key, dedupe just falls back
to the prior always-add behavior (safe: never erases, only risks the old
transient duplicate). Legacy queued items without a key also fall back to
always-add.
