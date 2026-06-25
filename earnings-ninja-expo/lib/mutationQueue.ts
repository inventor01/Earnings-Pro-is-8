import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EntryCreate, Entry, Goal, TimeframeType } from './api';

// Offline queue for NON-create writes — entry edits, deletes, and goal upserts.
// Creates have their own queue (`offlineQueue.ts`) because they synthesize a
// negative-id row for the optimistic UI; the ops here always target rows that
// ALREADY exist on the server (positive ids) or a goal timeframe.
//
// Mirrors offlineQueue's safety model: a process-local lock serializes every
// read-modify-write against AsyncStorage, and a single-drain guard prevents two
// concurrent drains from double-applying an op (no duplicates).
//
// Conflict policy is last-write-wins resolved at SYNC time: when the queue
// drains, each op is replayed against the server, so the device that syncs last
// produces the surviving server state. A 404 while replaying an edit/delete
// means the row was removed elsewhere — the op is dropped (remote delete wins)
// rather than retried forever. (True per-edit-timestamp resolution would need a
// GET /entries/{id} the deployed backend doesn't expose; sync-time LWW is the
// pragmatic equivalent for a single user across devices.)

const QUEUE_KEY = 'offline_mutation_queue_v1';

export type QueuedMutation =
  | { clientId: string; queuedAt: number; kind: 'updateEntry'; id: number; patch: Partial<EntryCreate> }
  | { clientId: string; queuedAt: number; kind: 'deleteEntry'; id: number }
  | { clientId: string; queuedAt: number; kind: 'upsertGoal'; timeframe: TimeframeType; target_profit: number };

export type EnqueueInput =
  | { kind: 'updateEntry'; id: number; patch: Partial<EntryCreate> }
  | { kind: 'deleteEntry'; id: number }
  | { kind: 'upsertGoal'; timeframe: TimeframeType; target_profit: number };

export interface MutationHandlers {
  updateEntry: (id: number, patch: Partial<EntryCreate>) => Promise<Entry>;
  deleteEntry: (id: number) => Promise<void>;
  upsertGoal: (timeframe: TimeframeType, target_profit: number) => Promise<Goal>;
}

function randomId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

let queueOp: Promise<unknown> = Promise.resolve();
function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = queueOp.then(fn, fn);
  queueOp = result.then(() => undefined, () => undefined);
  return result;
}

async function readQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedMutation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // AsyncStorage full — surfaced elsewhere.
  }
}

// Enqueue with light coalescing so repeated offline edits to the same target
// don't pile up (and so a delete supersedes pending edits for the same row):
//  - updateEntry: merge into an existing pending edit for the same id.
//  - deleteEntry: drop any pending edits for that id; collapse duplicate deletes.
//  - upsertGoal:  keep only the latest target per timeframe.
export async function enqueueMutation(input: EnqueueInput): Promise<void> {
  return withQueueLock(async () => {
    const items = await readQueue();
    const lastQueuedAt = items.reduce((max, it) => Math.max(max, it.queuedAt), 0);
    const queuedAt = Math.max(Date.now(), lastQueuedAt + 1);

    if (input.kind === 'updateEntry') {
      // If a delete is already pending for this row, the edit is moot.
      if (items.some(it => it.kind === 'deleteEntry' && it.id === input.id)) return;
      const existing = items.find(it => it.kind === 'updateEntry' && it.id === input.id);
      if (existing && existing.kind === 'updateEntry') {
        existing.patch = { ...existing.patch, ...input.patch };
        existing.queuedAt = queuedAt;
        await writeQueue(items);
        return;
      }
      items.push({ clientId: randomId(), queuedAt, kind: 'updateEntry', id: input.id, patch: input.patch });
      await writeQueue(items);
      return;
    }

    if (input.kind === 'deleteEntry') {
      const kept = items.filter(it => !(it.kind === 'updateEntry' && it.id === input.id));
      if (kept.some(it => it.kind === 'deleteEntry' && it.id === input.id)) {
        await writeQueue(kept);
        return;
      }
      kept.push({ clientId: randomId(), queuedAt, kind: 'deleteEntry', id: input.id });
      await writeQueue(kept);
      return;
    }

    // upsertGoal — one pending op per timeframe (latest target wins).
    const kept = items.filter(it => !(it.kind === 'upsertGoal' && it.timeframe === input.timeframe));
    kept.push({ clientId: randomId(), queuedAt, kind: 'upsertGoal', timeframe: input.timeframe, target_profit: input.target_profit });
    await writeQueue(kept);
  });
}

export async function getOpQueueDepth(): Promise<number> {
  const items = await readQueue();
  return items.length;
}

// Read-only snapshot of queued edit/delete/goal ops. Used by the local data
// store so cold-start offline rollups/lists reflect pending edits and deletes.
export async function getQueuedOps(): Promise<QueuedMutation[]> {
  return readQueue();
}

function isPermanent4xx(status: number | undefined): boolean {
  return (
    typeof status === 'number' &&
    status >= 400 && status < 500 &&
    status !== 401 && status !== 408 && status !== 429
  );
}

let draining = false;

// Replay queued ops in order. Stops on a transient failure (network / 5xx) and
// keeps that op + everything after it for the next drain. Permanent failures
// (non-retryable 4xx, including 404 = row gone) are dropped so the head can't
// wedge the queue. Idempotent: replaying the same PUT/DELETE/goal twice yields
// the same server state, so a duplicate drain can't corrupt data.
export async function drainMutationQueue(
  handlers: MutationHandlers,
): Promise<{ flushed: number; failed: number; dropped: number }> {
  if (draining) return { flushed: 0, failed: 0, dropped: 0 };
  draining = true;
  try {
    const items = await withQueueLock(async () => readQueue());
    if (items.length === 0) return { flushed: 0, failed: 0, dropped: 0 };

    let flushed = 0;
    let dropped = 0;
    const resolved = new Set<string>();

    for (const item of items) {
      try {
        if (item.kind === 'updateEntry') {
          await handlers.updateEntry(item.id, item.patch);
        } else if (item.kind === 'deleteEntry') {
          await handlers.deleteEntry(item.id);
        } else {
          await handlers.upsertGoal(item.timeframe, item.target_profit);
        }
        flushed += 1;
        resolved.add(item.clientId);
      } catch (err: any) {
        const status: number | undefined = err?.status;
        if (isPermanent4xx(status)) {
          // Includes 404 — the row was deleted elsewhere; dropping the edit/
          // delete is the correct last-write-wins outcome (remote delete wins).
          dropped += 1;
          resolved.add(item.clientId);
          continue;
        }
        // Network failure or 5xx — stop; keep this op and everything after it.
        break;
      }
    }

    await withQueueLock(async () => {
      const current = await readQueue();
      const next = current.filter(it => !resolved.has(it.clientId));
      await writeQueue(next);
    });

    return { flushed, failed: items.length - flushed - dropped, dropped };
  } finally {
    draining = false;
  }
}

export async function clearMutationQueue(): Promise<void> {
  await withQueueLock(async () => {
    await AsyncStorage.removeItem(QUEUE_KEY);
  });
}
