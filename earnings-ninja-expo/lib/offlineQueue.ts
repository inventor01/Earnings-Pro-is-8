import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EntryCreate, Entry } from './api';

// Offline queue for entry submissions. When the user taps Add while their
// network is flaky / down (very common while driving), we persist the entry
// payload to AsyncStorage and return a synthetic Entry so the UI doesn't
// surface an error. The drainer below replays queued entries the next time
// the app comes to the foreground (and on any successful network request).
//
// Persistence shape: JSON array of { id, payload, queuedAt } under one key.
// We use a UUID-like client id so React Query has something stable to key
// off, and so duplicate-drain attempts can be deduped.

const QUEUE_KEY = 'offline_entry_queue_v1';

export interface QueuedEntry {
  clientId: string;
  payload: EntryCreate;
  queuedAt: number;
}

function randomId(): string {
  // Tiny non-crypto id — only needs to be unique within this device's queue.
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Every queue mutation is an unsynchronized read-modify-write against
// AsyncStorage (readQueue → mutate → writeQueue). Without serialization, two
// operations that interleave (e.g. a save while the foreground drain is
// running, or two rapid saves on flaky network) can both read the same
// snapshot and the second write clobbers the first — silently dropping a
// queued entry or resurrecting a just-deleted one. This process-local promise
// chain forces every mutation to run one-at-a-time. It does NOT protect across
// app processes, but the offline queue is only ever touched from this single
// JS runtime, so that is sufficient.
let queueOp: Promise<unknown> = Promise.resolve();
function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  // Run `fn` after whatever is currently queued, regardless of its outcome.
  const result = queueOp.then(fn, fn);
  // Keep the chain alive even if `fn` rejects, so one failure can't wedge all
  // future queue operations. The caller still receives `result` (and its error).
  queueOp = result.then(() => undefined, () => undefined);
  return result;
}

async function readQueue(): Promise<QueuedEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // If AsyncStorage is full, swallow — the user gets an error path elsewhere.
  }
}

export async function enqueueEntry(payload: EntryCreate): Promise<QueuedEntry> {
  return withQueueLock(async () => {
    const items = await readQueue();
    // The synthetic Entry id is derived directly from `queuedAt` (see
    // synthesizeEntry), so two entries that share a queuedAt would collide on
    // id — causing React duplicate-key warnings AND, worse, deleting one offline
    // row would remove every queued row sharing that id. Guarantee a strictly
    // unique, monotonically increasing queuedAt so the derived id is always
    // unique, even when several entries are added in the same millisecond.
    const lastQueuedAt = items.reduce((max, it) => Math.max(max, it.queuedAt), 0);
    const item: QueuedEntry = {
      clientId: randomId(),
      payload,
      queuedAt: Math.max(Date.now(), lastQueuedAt + 1),
    };
    items.push(item);
    await writeQueue(items);
    return item;
  });
}

export async function getQueueDepth(): Promise<number> {
  const items = await readQueue();
  return items.length;
}

// Read-only snapshot of the queued (offline, never-synced) creates. Used by the
// local data store so cold-start offline rollups/lists include pending adds.
export async function getQueuedCreates(): Promise<QueuedEntry[]> {
  return readQueue();
}

// Returns a synthetic Entry that mirrors what the server would return, so
// the optimistic UI has something to render. id is negative + derived from
// queue position so React keys don't collide with real entries (server ids
// are positive auto-increment).
export function synthesizeEntry(item: QueuedEntry): Entry {
  const p = item.payload;
  const ts = new Date(item.queuedAt).toISOString();
  return {
    // Full-millisecond precision (not seconds): enqueueEntry guarantees
    // queuedAt is unique, so this negative id never collides with another
    // queued row's id.
    id: -item.queuedAt,
    timestamp: ts,
    type: p.type,
    app: p.app,
    custom_app: p.custom_app ?? null,
    custom_type: p.custom_type ?? null,
    custom_category: p.custom_category ?? null,
    amount: p.amount,
    distance_miles: p.distance_miles ?? 0,
    duration_minutes: p.duration_minutes ?? 0,
    category: p.category,
    note: p.note,
    receipt_url: p.receipt_url,
    created_at: ts,
    updated_at: ts,
  };
}

// Drain the queue by POSTing each item with the supplied uploader. The
// uploader is the real `api.createEntry` rewritten to bypass the queue
// (`createEntryRaw`) so we don't recurse. On failure (network or 5xx) we
// re-queue and stop; on a 4xx the payload is permanently bad (e.g. receipt
// too big) so we drop it and log — keeping it forever would block all
// future drains. Caller should refetch React Query state after this.
let draining = false;
export async function drainQueue(
  uploader: (payload: EntryCreate) => Promise<Entry>,
): Promise<{ flushed: number; failed: number; dropped: number }> {
  // Only ONE drain may run at a time. The drainer is triggered from multiple
  // places (app foreground + after any successful network request); two
  // concurrent drains would each snapshot the same queue and upload the same
  // items, creating duplicate rows on the server. Bail out if one is in flight.
  if (draining) return { flushed: 0, failed: 0, dropped: 0 };
  draining = true;
  try {
    // Snapshot the queue under the lock. The network uploads below run OUTSIDE
    // the lock (they can be slow and we must not block a user's save for the
    // whole drain); we reconcile by `clientId` at the end so any entry enqueued
    // mid-drain is preserved rather than clobbered.
    const items = await withQueueLock(async () => readQueue());
    if (items.length === 0) return { flushed: 0, failed: 0, dropped: 0 };

    let flushed = 0;
    let dropped = 0;
    // Items the user deleted mid-drain (no longer in the queue) — neither
    // uploaded nor a failure, just gone. Tracked so the `failed` count stays honest.
    let skipped = 0;
    // clientIds that are now resolved (uploaded OK or permanently dropped) and
    // should be removed from the persisted queue. Anything NOT in here — failed
    // items and everything after a transient failure — stays queued.
    const resolved = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // The user may have deleted this still-queued row while the drain was
      // uploading earlier items. Re-check (by clientId, under the lock) that it
      // still exists right before uploading, so we never resurrect an entry the
      // user explicitly deleted.
      const stillQueued = await withQueueLock(async () => {
        const cur = await readQueue();
        return cur.some(it => it.clientId === item.clientId);
      });
      if (!stillQueued) { skipped += 1; continue; }

      try {
        await uploader(item.payload);
        flushed += 1;
        resolved.add(item.clientId);
      } catch (err: any) {
        // Classify by HTTP status, not message regex (the old regex missed
        // 422 entirely, so oversized-receipt entries retried forever and
        // jammed the queue head, blocking every later entry).
        // - No status        → network failure, keep queued.
        // - 401/408/429      → transient (stale auth / timeout / rate limit), keep.
        // - 5xx              → server hiccup, keep.
        // - Any other 4xx    → payload is permanently bad, drop and continue.
        const status: number | undefined = err?.status;
        const is4xxPermanent =
          typeof status === 'number' &&
          status >= 400 && status < 500 &&
          status !== 401 && status !== 408 && status !== 429;
        if (is4xxPermanent) {
          dropped += 1;
          resolved.add(item.clientId);
          continue;
        }
        // Network failure or 5xx — stop here and keep this item plus everything
        // after it queued (don't add them to `resolved`).
        break;
      }
    }

    // Remove only the resolved items, re-reading under the lock so entries the
    // user enqueued WHILE this drain was uploading are not lost.
    await withQueueLock(async () => {
      const current = await readQueue();
      const next = current.filter(it => !resolved.has(it.clientId));
      await writeQueue(next);
    });

    return { flushed, failed: items.length - flushed - dropped - skipped, dropped };
  } finally {
    draining = false;
  }
}

// Remove a still-queued (offline, never-persisted) entry by the negative
// synthetic id that `synthesizeEntry` derived from its `queuedAt`. Used by
// `deleteEntry` so deleting an offline row drops it from the queue instead of
// firing a doomed DELETE for a server id that doesn't exist — and so the
// background drainer won't later re-create the row the user just deleted.
// Returns true when a queued item was actually found and removed.
export async function removeQueuedBySyntheticId(syntheticId: number): Promise<boolean> {
  return withQueueLock(async () => {
    const items = await readQueue();
    const next = items.filter(it => -it.queuedAt !== syntheticId);
    if (next.length === items.length) return false;
    await writeQueue(next);
    return true;
  });
}

// Edit a still-queued (offline, never-persisted) entry in place, keyed by the
// negative synthetic id `synthesizeEntry` derived from its `queuedAt`. Used by
// `updateEntry` so editing an offline-created row updates the QUEUED payload
// (which carries the new values when it finally syncs) rather than firing a
// doomed PUT for a server id that doesn't exist yet. `patch` uses the same
// EntryCreate shape as the create payload, so merging is field-compatible.
// Returns true when a queued item was found and updated.
export async function updateQueuedBySyntheticId(
  syntheticId: number,
  patch: Partial<EntryCreate>,
): Promise<boolean> {
  return withQueueLock(async () => {
    const items = await readQueue();
    let found = false;
    const next = items.map(it => {
      if (-it.queuedAt !== syntheticId) return it;
      found = true;
      return { ...it, payload: { ...it.payload, ...patch } };
    });
    if (found) await writeQueue(next);
    return found;
  });
}

export async function clearQueue(): Promise<void> {
  await withQueueLock(async () => {
    await AsyncStorage.removeItem(QUEUE_KEY);
  });
}
