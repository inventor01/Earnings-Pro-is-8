import { useSyncExternalStore } from 'react';

// Tiny dependency-free observable store for the connection / sync status that
// the SyncIndicator renders and the drainer updates. Kept import-free (no api,
// no queues) so anything can feed it without creating an import cycle:
//   connectivity.ts -> reportSuccess/reportFailure -> setOnline
//   pendingCount.ts -> reads both queues -> setPending
//   _layout drain   -> setSyncing around a drain
export interface SyncState {
  /** Best-effort guess of network reachability, derived from fetch outcomes. */
  online: boolean;
  /** Total queued offline writes (creates + edits/deletes/goals) awaiting sync. */
  pending: number;
  /** True while a drain is actively replaying queued writes to the server. */
  syncing: boolean;
}

let state: SyncState = { online: true, pending: 0, syncing: false };

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSync(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setOnline(online: boolean): void {
  if (state.online === online) return;
  state = { ...state, online };
  emit();
}

export function setPending(pending: number): void {
  if (state.pending === pending) return;
  state = { ...state, pending };
  emit();
}

export function setSyncing(syncing: boolean): void {
  if (state.syncing === syncing) return;
  state = { ...state, syncing };
  emit();
}

// React hook — getSnapshot returns a STABLE reference until something actually
// changes, so useSyncExternalStore won't loop.
export function useSyncStatus(): SyncState {
  return useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
}
