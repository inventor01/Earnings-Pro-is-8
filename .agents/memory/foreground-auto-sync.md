---
name: Foreground auto-sync of the offline queue
description: Why the offline-queue drain needs a post-enqueue trigger + foreground retry, not just lifecycle/connectivity events.
---

# Foreground auto-sync of the offline queue

The offline queues (create queue + edit/delete/goal mutation queue) historically
drained on only three triggers: cold start, app foreground (AppState 'active'),
and a connectivity flip offline→online.

**The gap:** a *transient* write failure where the server stays reachable — a 5xx
or a request timeout, not a true network drop — never flips connectivity to
"offline" (connectivity.ts derives online/offline from fetch outcomes: any HTTP
response, even 5xx, counts as "online"). So with the app left open the whole
time, none of the three triggers fire and the queued write sits unsynced until
the user closes + reopens the app.

**The rule:** queued writes must also be drained by (1) an explicit trigger fired
the moment a write falls back to a queue, and (2) a self-rescheduling foreground
retry on a backoff while any queue is non-empty.

**Why:** lifecycle/connectivity events are necessary but not sufficient — they
miss the "stayed open + server reachable but write failed" case, which is the
common driving-with-flaky-signal scenario.

**How to apply:**
- `lib/syncTrigger.ts` is the bridge: the root layout `registerDrainHandler()`s
  its drain routine; non-React code (`api.ts`) calls `requestDrain()` after each
  offline enqueue. It's a no-op when nothing is registered (tests / pre-mount).
- The drain effect in `app/_layout.tsx` owns the backoff retry loop
  (`scheduleRetry`): re-arm only while foregrounded AND a queue is non-empty;
  reset the backoff on a real flush, on foreground return, and on a fresh
  trigger; gate on AppState (clear on background, resume on foreground); set a
  `disposed` flag in cleanup so an in-flight drain's `finally` can't re-arm a
  stray timer after teardown.
- Non-negotiable invariants this must preserve: single-drain re-entrancy guard,
  per-record last-write-wins on edits/deletes/goals, create idempotency-key
  dedupe, and "only invalidate caches after a write truly persists (positive
  server id), never after a merely-queued write."
- Full dup protection on a timed-out-but-saved create still depends on the
  backend echoing/honoring the idempotency key in production (Railway); the
  client falls back safely if it doesn't.
- JS-only → OTA-deployable; do NOT add a native connectivity lib (would change
  the fingerprint and break OTA delivery to the installed build).
