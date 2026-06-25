---
name: Offline local source-of-truth (mobile)
description: Why the Expo app needs a real local data layer (not just RQ cache) for offline reads, and the LWW rules that keep offline writes safe.
---

# Offline reads need a local source-of-truth, not just the RQ cache

React-Query cache-persistence only covers windows the user already viewed, so a
cold-start offline read of an un-viewed period returns nothing. The durable fix is
a **local mirror of server data** that the read APIs fall back to and recompute
rollups/lists from.

**Rules:**
- Read APIs fall back to local computation **only on a thrown network error**; a
  non-2xx still throws (never mask auth/server errors with stale local data).
- Offline reads overlay the pending offline queues on the mirror (queued creates
  added, edits applied, deletes removed) so the UI reflects un-synced work.
- All read-modify-write on the local store (entries **and** goals) must be
  serialized behind a single store lock, or concurrent writes clobber each other.
- Keep EST day-bucketing identical to the backend; the client must not use the
  device clock for "is this today?" (see est-vs-device-local-date.md).

# Offline writes use strict per-record LWW by SERVER timestamp

Each queued edit/delete/goal records the server `updated_at` of the version it
branched from (the "baseline"). On drain, drop the queued op only if the server's
current `updated_at` is strictly newer than that baseline; otherwise push it.

**Why:** simple single-user-across-devices semantics — most-recent change wins —
without CRDT/field-merge. The reviewer rejected anything weaker.

**Non-negotiables (each one was a separate review rejection):**
- **Never** use the device wall-clock as a baseline; the only valid baseline is a
  server `updated_at`. Clock skew makes wall-clock comparisons unsafe.
- **Missing baseline ⇒ yield to the server** (drop the op if a server row exists),
  never blind-push — a blind push can clobber a newer server version.
- The baseline must be **authoritative at enqueue time**. That requires two things
  working together:
  1. Every successful raw write (create/update/delete entry, upsert goal) must
     **await** its write-through into the mirror before returning, so a follow-up
     offline edit branches from the current server version.
  2. Every read that feeds the UI must **await** its mirror write before returning,
     so a record the UI renders is already in the mirror — otherwise an edit fired
     in that window enqueues with no baseline and the strict gate drops it (lost
     write). Fire-and-forget mirror writes are NOT acceptable on these paths.

**How to apply:** any new offline-capable read needs a matching local computation +
the network-only fallback; any new offline-capable write needs awaited write-through
and an awaited-baseline read path, plus a server-timestamp LWW gate in the drainer.
