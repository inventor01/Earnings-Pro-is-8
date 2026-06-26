import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, useQueryClient, focusManager } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { SubscriptionProvider } from '@/lib/revenuecat';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { HiddenModeProvider, useHiddenMode } from '@/lib/hiddenMode';
import { api, API_BASE } from '@/lib/api';
import { drainQueue, getQueueDepth } from '@/lib/offlineQueue';
import { drainMutationQueue, getOpQueueDepth } from '@/lib/mutationQueue';
import { invalidateEntryData } from '@/lib/queryInvalidation';
import { refreshMotivationSchedule, MOTIVATION_IDS } from '@/lib/notifications';
import { playKaching } from '@/lib/sound';
import { hydrateQueryClient, startPersisting } from '@/lib/queryPersist';
import { initConnectivity } from '@/lib/connectivity';
import { setSyncing, subscribeSync, getSyncState } from '@/lib/syncStatus';
import { refreshPendingCount } from '@/lib/pendingCount';
import { SyncIndicator } from '@/components/SyncIndicator';
import * as Notifications from 'expo-notifications';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // Keep cached data around long enough that a hydrated cold-start cache
      // (offline reads) isn't garbage-collected before its query re-mounts.
      gcTime: 1000 * 60 * 60 * 24 * 14, // 14 days
      // Run queries even when we believe we're offline: the request will fail
      // fast, React Query retains the (hydrated) data, and the failed fetch
      // drives the connectivity tracker. Without this, offline queries sit in
      // 'paused' and the UI shows nothing on a cold start.
      networkMode: 'always',
    },
    mutations: { networkMode: 'always' },
  },
});

function RootNav() {
  const { token, isLoading } = useAuth();
  const { hidden } = useHiddenMode();
  const { BG, isDark } = useTheme();
  const queryClient = useQueryClient();
  const draining = useRef(false);
  const prevToken = useRef<string | null>(token);

  useEffect(() => {
    if (!isLoading) {
      if (token) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    }
  }, [token, isLoading]);

  // On logout (token cleared), wipe the IN-MEMORY query cache too. authContext
  // already clears the persisted on-disk copies; clearing the live cache here
  // prevents the persist subscriber from immediately re-writing the previous
  // user's data back to disk, and stops a different account signing in on the
  // same device from briefly seeing stale dashboards.
  useEffect(() => {
    if (prevToken.current && !token) {
      queryClient.clear();
    }
    prevToken.current = token;
  }, [token, queryClient]);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Wire React Query's focusManager to React Native AppState. On native there is
  // no browser "window focus" event, so without this React Query NEVER refetches
  // when the app returns to the foreground — meaning data that changed while the
  // app was backgrounded (hourly OAuth order sync, edits from the web app/another
  // device, or anything not refreshed by a local mutation) only appears after a
  // FULL exit + reopen (which recreates the QueryClient from scratch). Forwarding
  // active/inactive into focusManager makes stale queries (past the 30s staleTime)
  // refetch on foreground; the staleTime still suppresses refetches on quick
  // background/foreground toggles.
  useEffect(() => {
    const onChange = (status: AppStateStatus) => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  // Drain the offline entry queue whenever the app comes to the foreground
  // (or on cold start when we already have an auth token). Re-entrancy
  // guarded by `draining` so a quick background/foreground cycle doesn't
  // fire two concurrent drains. On any flush we invalidate the lists the
  // dashboard renders so the newly-synced entries appear.
  useEffect(() => {
    if (!token) return;
    const tryDrain = async () => {
      if (draining.current) return;
      draining.current = true;
      try {
        const [createDepth, opDepth] = await Promise.all([getQueueDepth(), getOpQueueDepth()]);
        let changed = false;

        // 1. Push offline-created rows first (brand-new records, no conflict
        //    possible) so a create that earns a real server id isn't later
        //    targeted by a queued edit using its stale negative id.
        if (createDepth > 0) {
          setSyncing(true);
          const r = await drainQueue(api.createEntryRaw.bind(api));
          if (r.flushed > 0 || r.dropped > 0) changed = true;
        }

        // 2. Authoritative pull into the LOCAL mirror (the offline source of
        //    truth) so cold-start offline reads cover EVERY period and reflect
        //    deletions made elsewhere. This also gives us the server's CURRENT
        //    `updated_at` per record, which the queue drain needs for per-record
        //    last-write-wins. Throws & is skipped silently when offline — in
        //    which case there's nothing we could push anyway.
        let serverTsById: Map<number, string> | null = null;
        try {
          const serverEntries = await api.getAllEntries();
          serverTsById = new Map<number, string>();
          for (const e of serverEntries) {
            if (typeof e.id === 'number' && e.id > 0) serverTsById.set(e.id, e.updated_at);
          }
        } catch {
          // Offline — leave serverTsById null and bail on the push below.
        }

        // 3. Drain edits/deletes/goals with per-record last-write-wins: drop any
        //    op whose record was changed more recently on the server (another
        //    device) than the baseline it branched from. Only runs when the pull
        //    succeeded (we have authoritative timestamps and a live connection).
        if (opDepth > 0 && serverTsById) {
          const tsMap = serverTsById;
          setSyncing(true);
          const r = await drainMutationQueue(
            {
              updateEntry: (id, patch) => api.updateEntryRaw(id, patch),
              deleteEntry: (id) => api.deleteEntryRaw(id),
              upsertGoal: (tf, target) => api.upsertGoalRaw(tf, target),
            },
            async (op) => {
              // Strict per-record LWW by SERVER update timestamp. `baseUpdatedAt`
              // is the server `updated_at` of the version this op branched from.
              // With awaited write-through on every raw write, any record the
              // user could edit is in the mirror with a current updated_at, so a
              // queued update/delete/goal always carries an authoritative
              // baseline in normal flows.
              //
              // Conflict resolution:
              //  - server has no row  → nothing to clobber → replay (push).
              //  - baseline present   → drop our op only if the server is
              //                         strictly newer than the version we edited.
              //  - baseline MISSING   → we cannot prove our edit is newer, so we
              //                         yield to the server's existing row and
              //                         drop the op rather than risk clobbering a
              //                         newer server version. We never fall back
              //                         to the device clock.
              if (op.kind === 'updateEntry' || op.kind === 'deleteEntry') {
                const serverTs = tsMap.get(op.id);
                if (serverTs === undefined) return false; // not on server → handled as 404/remote-delete
                if (!op.baseUpdatedAt) return true; // no authoritative baseline → server row wins
                return new Date(serverTs).getTime() > new Date(op.baseUpdatedAt).getTime();
              }
              if (op.kind === 'upsertGoal') {
                let cur;
                try {
                  cur = await api.getGoal(op.timeframe);
                } catch {
                  return false; // can't reach server → let the op replay later
                }
                if (!cur || !cur.updated_at) return false; // no server row → nothing to clobber
                if (!op.baseUpdatedAt) return true; // no authoritative baseline → server row wins
                return new Date(cur.updated_at).getTime() > new Date(op.baseUpdatedAt).getTime();
              }
              return false;
            },
          );
          if (r.flushed > 0 || r.dropped > 0) changed = true;
        }

        // 4. If we pushed any local writes, re-pull so the mirror reflects them,
        //    then invalidate the lists/Analytics caches so the synced data shows.
        if (changed) {
          try { await api.getAllEntries(); } catch {}
          invalidateEntryData(queryClient);
        }
      } finally {
        setSyncing(false);
        draining.current = false;
        await refreshPendingCount();
      }
    };
    // Re-arm the daily motivation notifications with the latest numbers. No-ops
    // when the feature is disabled. Runs alongside the queue drain so the
    // evening recap reflects data from the most recent app open.
    const refreshNotifs = () => { refreshMotivationSchedule().catch(() => {}); };

    tryDrain();
    refreshNotifs();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') { tryDrain(); refreshNotifs(); }
    });
    // Also drain the instant connectivity flips from offline → online (the
    // health probe recovered), without waiting for a foreground event.
    let wasOnline = getSyncState().online;
    const unsubscribeSync = subscribeSync(() => {
      const nowOnline = getSyncState().online;
      if (nowOnline && !wasOnline) tryDrain();
      wasOnline = nowOnline;
    });
    return () => { sub.remove(); unsubscribeSync(); };
  }, [token, queryClient]);

  // Re-author the scheduled notifications the instant Hidden Mode changes, so a
  // dollar amount can never linger in an already-queued notification (and surface
  // on a public lock screen) after the user masks their numbers. `force` bypasses
  // the foreground cooldown; the call no-ops when notifications are disabled.
  useEffect(() => {
    if (!token) return;
    refreshMotivationSchedule({ hidden, force: true }).catch(() => {});
  }, [hidden, token]);

  // Play the ka-ching sound effect when one of our motivation notifications is
  // delivered while the app is in the foreground (iOS only fires this listener
  // for foreground deliveries). Gated by the Settings sound toggle inside
  // playKaching(); other (future) local notifications are ignored by id.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const id = n.request?.identifier;
      if (id && MOTIVATION_IDS.includes(id)) {
        playKaching().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  // Deep links from the iOS widget land here. The widget tile fires
  // `earningsninja://entry/new` when tapped. We forward into the dashboard
  // with `?openEntry=…` so the AddEntryModal opens automatically.
  useEffect(() => {
    if (isLoading || !token) return;
    const handle = (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      // Only `earningsninja://entry/new` (and trailing /) is honored — any
      // other path is ignored so future deep links don't accidentally open
      // the AddEntry modal.
      if (parsed.hostname !== 'entry') return;
      const path = (parsed.path ?? '').replace(/^\/+|\/+$/g, '');
      if (path !== 'new') return;
      const type = String(parsed.queryParams?.type ?? '').toUpperCase();
      const amount = String(parsed.queryParams?.amount ?? '');
      const params: Record<string, string> = { openEntry: '1' };
      if (type === 'EXPENSE' || type === 'REVENUE') params.type = type;
      if (amount) params.amount = amount;
      router.replace({ pathname: '/(tabs)', params });
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [isLoading, token]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: BG } }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="index" />
      </Stack>
      <SyncIndicator />
    </>
  );
}

export default function RootLayout() {
  // Gate the first render on cache hydration so the persisted React Query cache
  // is loaded BEFORE any query mounts (otherwise a freshly-mounted empty query
  // wins and hydrate can't overwrite it). This is what makes a cold start with
  // no network show real dashboard/history/goals data. The native splash stays
  // up meanwhile (preventAutoHideAsync); RootNav hides it after mount.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    (async () => {
      await hydrateQueryClient(queryClient);
      startPersisting(queryClient);
      initConnectivity(`${API_BASE}/api/health`);
      await refreshPendingCount();
      setHydrated(true);
    })();
  }, []);

  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <HiddenModeProvider>
              <AuthProvider>
                <SubscriptionProvider>
                  <RootNav />
                </SubscriptionProvider>
              </AuthProvider>
            </HiddenModeProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
