import AsyncStorage from '@react-native-async-storage/async-storage';
import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';

// Persist the React Query cache to AsyncStorage so the app has REAL data to
// render on a cold start with no network (offline-first reads). Uses only the
// already-installed `@tanstack/react-query` (dehydrate/hydrate) + AsyncStorage —
// deliberately NOT `@tanstack/react-query-persist-client`, to avoid adding a
// dependency that could shift the native fingerprint and stop OTA updates from
// reaching the installed build.

const CACHE_KEY = 'rq_cache_v1';
const SAVE_DEBOUNCE_MS = 1500;

// Only persist the data-bearing query namespaces the dashboard/history/analytics
// render. Everything else (one-off / volatile) is left out to keep the blob small.
const PERSIST_PREFIXES = new Set<string>([
  'entries',
  'rollup',
  'goal',
  'entries-range',
  'analytics-rollup',
  'analytics-entries',
]);

function shouldPersistKey(queryKey: readonly unknown[]): boolean {
  const head = queryKey?.[0];
  return typeof head === 'string' && PERSIST_PREFIXES.has(head);
}

// Hydrate MUST run before any query mounts, otherwise a freshly-mounted query
// wins and hydrate won't overwrite it. The caller gates the first render on this.
export async function hydrateQueryClient(qc: QueryClient): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    hydrate(qc, state);
  } catch {
    // Corrupt / unreadable cache — start cold rather than crash.
  }
}

// Wipe the persisted query cache. Called on logout so the next account can't
// cold-start into the previous user's dashboard/history blob.
export async function clearPersistedCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // best-effort
  }
}

// While the local sandbox Demo Mode is active, persisting is suspended so demo
// data can never be flushed to disk and cold-start into a later real session.
// (authContext toggles this on enterDemo/exitDemo.)
let persistSuspended = false;

export function setPersistSuspended(suspended: boolean): void {
  persistSuspended = suspended;
}

let unsubscribe: (() => void) | null = null;

// Subscribe to the query cache and persist a throttled snapshot. Leading +
// trailing so the first change is written promptly and a burst collapses into
// one trailing write.
export function startPersisting(qc: QueryClient): () => void {
  if (unsubscribe) return unsubscribe;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let trailing = false;

  const persist = async () => {
    if (persistSuspended) return;
    try {
      const dehydrated = dehydrate(qc, {
        shouldDehydrateQuery: (q) =>
          q.state.status === 'success' && shouldPersistKey(q.queryKey),
      });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(dehydrated));
    } catch {
      // AsyncStorage full / serialization issue — skip this snapshot.
    }
  };

  const schedule = () => {
    if (timer) {
      trailing = true;
      return;
    }
    void persist();
    timer = setTimeout(() => {
      timer = null;
      if (trailing) {
        trailing = false;
        void persist();
      }
    }, SAVE_DEBOUNCE_MS);
  };

  const sub = qc.getQueryCache().subscribe(schedule);
  // Write an initial snapshot (covers data hydrated/loaded before first change).
  schedule();

  unsubscribe = () => {
    sub();
    if (timer) clearTimeout(timer);
    unsubscribe = null;
  };
  return unsubscribe;
}
