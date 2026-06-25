---
name: offline queue synthetic-id identity and drain safety
description: Rules for the Expo offline entry queue so queued entries are never duplicated, mis-deleted, lost, or resurrected.
---

# Offline queue: stable identity + race-safe drain

The Expo app queues entry saves while offline and synthesizes negative-id rows so
they render before sync. Four invariants must hold (each was a real bug):

1. **Synthetic ids must be unique AND stable.** Deriving the id from a 1-second
   resolution timestamp (`-Math.floor(queuedAt/1000)`) collides when two entries
   are queued in the same second → duplicate React keys and deleting one row
   removes the wrong one. Fix: assign each queued item a **unique monotonic**
   `queuedAt` (`Math.max(Date.now(), lastQueuedAt+1)`) and use `id: -queuedAt`
   everywhere (synthesize + delete-by-synthetic-id matches `-queuedAt`).

2. **Serialize AsyncStorage read-modify-write.** enqueue / remove / clear all do
   read→modify→write on the same key; concurrent calls clobber each other. Wrap
   them in a single promise-chain lock (`withQueueLock`).

3. **Single drain at a time.** Two concurrent drains upload the same items twice.
   Guard with a module-level `draining` flag.

4. **Do not resurrect deleted items mid-drain.** The drain must snapshot under the
   lock but upload **outside** the lock (never hold a lock across network I/O); for
   each item re-read the queue and skip it if it was deleted (matched by a stable
   `clientId`) while uploading. Reconcile by `clientId` from a fresh read, not by
   array index. `failed = items.length - flushed - dropped - skipped`.

**Why:** identity is the crux — a queued entry has no server id yet, so every
operation (render key, delete, dedupe, reconcile) must key off a stable client-side
identity (`clientId` / unique `queuedAt`), never a positional index or a coarse
timestamp.

**How to apply:** any change to the offline queue must preserve these four
invariants; a small TOCTOU window remains (lock not held across the upload) and is
accepted because the per-item delete re-check covers the common case.
