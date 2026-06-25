import { getQueueDepth } from './offlineQueue';
import { getOpQueueDepth } from './mutationQueue';
import { setPending } from './syncStatus';

// Recompute the total number of queued offline writes (creates + edits/deletes/
// goals) and publish it to the sync-status store that drives the indicator.
// Kept in its own module so the queues and api.ts stay free of import cycles:
// this imports the queues; the queues never import this.
export async function refreshPendingCount(): Promise<void> {
  try {
    const [creates, mutations] = await Promise.all([getQueueDepth(), getOpQueueDepth()]);
    setPending(creates + mutations);
  } catch {
    // Best-effort — a failed count read just leaves the indicator unchanged.
  }
}
