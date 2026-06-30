// Lets non-React modules (notably api.ts) ask the app to flush the offline
// queues immediately, instead of waiting for an app-lifecycle event (cold
// start / foreground / offline->online flip). The root layout registers the
// real drain routine on mount; callers fire-and-forget `requestDrain()`.
//
// Import-free (depends on nothing) so any module can call it without risking an
// import cycle. When no handler is registered (e.g. in unit tests, or before
// the layout mounts) `requestDrain` is a harmless no-op.

type DrainHandler = () => void;

let handler: DrainHandler | null = null;

export function registerDrainHandler(fn: DrainHandler): () => void {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

export function requestDrain(): void {
  handler?.();
}
