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
  const item: QueuedEntry = {
    clientId: randomId(),
    payload,
    queuedAt: Date.now(),
  };
  const items = await readQueue();
  items.push(item);
  await writeQueue(items);
  return item;
}

export async function getQueueDepth(): Promise<number> {
  const items = await readQueue();
  return items.length;
}

// Returns a synthetic Entry that mirrors what the server would return, so
// the optimistic UI has something to render. id is negative + derived from
// queue position so React keys don't collide with real entries (server ids
// are positive auto-increment).
export function synthesizeEntry(item: QueuedEntry): Entry {
  const p = item.payload;
  const ts = new Date(item.queuedAt).toISOString();
  return {
    id: -Math.floor(item.queuedAt / 1000),
    timestamp: ts,
    type: p.type,
    app: p.app,
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
export async function drainQueue(
  uploader: (payload: EntryCreate) => Promise<Entry>,
): Promise<{ flushed: number; failed: number; dropped: number }> {
  const items = await readQueue();
  if (items.length === 0) return { flushed: 0, failed: 0, dropped: 0 };

  let flushed = 0;
  let dropped = 0;
  const remaining: QueuedEntry[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      await uploader(item.payload);
      flushed += 1;
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
        continue;
      }
      // Network failure or 5xx — keep this and everything after it queued.
      remaining.push(...items.slice(i));
      await writeQueue(remaining);
      return { flushed, failed: items.length - flushed - dropped, dropped };
    }
  }

  await writeQueue(remaining);
  return { flushed, failed: 0, dropped };
}

// Remove a still-queued (offline, never-persisted) entry by the negative
// synthetic id that `synthesizeEntry` derived from its `queuedAt`. Used by
// `deleteEntry` so deleting an offline row drops it from the queue instead of
// firing a doomed DELETE for a server id that doesn't exist — and so the
// background drainer won't later re-create the row the user just deleted.
// Returns true when a queued item was actually found and removed.
export async function removeQueuedBySyntheticId(syntheticId: number): Promise<boolean> {
  const items = await readQueue();
  const next = items.filter(it => -Math.floor(it.queuedAt / 1000) !== syntheticId);
  if (next.length === items.length) return false;
  await writeQueue(next);
  return true;
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
