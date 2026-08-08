import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Text, TextInput, type AppStateStatus } from 'react-native';

// HIG Dynamic Type: respect the user's system text size but cap the multiplier
// so the dense KPI/dashboard layouts scale up gracefully instead of breaking.
// (Applied globally; individual Text components can still override.)
const T = Text as unknown as { defaultProps?: { maxFontSizeMultiplier?: number } };
const TI = TextInput as unknown as { defaultProps?: { maxFontSizeMultiplier?: number } };
T.defaultProps = { ...(T.defaultProps ?? {}), maxFontSizeMultiplier: 1.35 };
TI.defaultProps = { ...(TI.defaultProps ?? {}), maxFontSizeMultiplier: 1.35 };
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, useQueryClient, focusManager } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { SubscriptionProvider, useSubscription } from '@/lib/revenuecat';
import { setPendingReferral, clearPendingReferral } from '@/lib/pendingReferral';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { HiddenModeProvider, useHiddenMode } from '@/lib/hiddenMode';
import { api, API_BASE } from '@/lib/api';
import { drainQueue, getQueueDepth } from '@/lib/offlineQueue';
import { drainMutationQueue, getOpQueueDepth } from '@/lib/mutationQueue';
import { invalidateEntryData } from '@/lib/queryInvalidation';
import { refreshMotivationSchedule, isMotivationId } from '@/lib/notifications';
import { playKaching } from '@/lib/sound';
import { hydrateQueryClient, startPersisting } from '@/lib/queryPersist';
import { initConnectivity } from '@/lib/connectivity';
import { setSyncing, subscribeSync, getSyncState } from '@/lib/syncStatus';
import { refreshPendingCount } from '@/lib/pendingCount';
import { registerDrainHandler } from '@/lib/syncTrigger';
import { needsOnboarding, readOnboardingState, hasFreshSignupFlag, clearFreshSignupFlag, writeOnboardingState, adoptPendingDone } from '@/lib/onboarding';
import * as Notifications from 'expo-notifications';
import IntroVideo from '@/components/IntroVideo';
import DemoModeChrome from '@/components/DemoModeChrome';
import { getIntroEnabled } from '@/lib/introPref';

SplashScreen.preventAutoHideAsync();

// Backoff bounds for the foreground auto-sync retry loop. While the app is
// open and anything is still queued, we re-attempt a drain on a delay that
// starts short and doubles up to a cap; a successful flush (or a fresh trigger)
// resets it back to the base so the next hiccup retries quickly.
const SYNC_RETRY_BASE_MS = 3000;
const SYNC_RETRY_MAX_MS = 60000;

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
  const { token, isLoading, user, refreshUser, isDemo } = useAuth();
  const { hidden } = useHiddenMode();
  const { BG, isDark } = useTheme();
  const { refresh: refreshSubscription } = useSubscription();
  const queryClient = useQueryClient();
  const draining = useRef(false);
  // Session identity for the cache-wipe effect below: a real token, the local
  // demo sandbox, or signed out. Any transition OUT of a session (and INTO the
  // demo) wipes the in-memory query cache so data never crosses sessions.
  const sessionKey = token ?? (isDemo ? '__demo__' : null);
  const prevSession = useRef<string | null>(sessionKey);

  useEffect(() => {
    if (isLoading) return;
    if (isDemo && !token) {
      // Local sandbox demo: no onboarding funnel, no server flags — straight
      // to the dashboard with the seeded sample data.
      router.replace('/(tabs)');
      return;
    }
    if (!token) {
      router.replace('/login');
      return;
    }
    // Route fresh signups into the one-time onboarding funnel. Fail CLOSED
    // toward the dashboard: only an explicit server onboarding_completed=false
    // (or the just-signed-up flag while /auth/me is still resolving) shows it;
    // existing users go straight to the dashboard. The server flag is
    // authoritative even for demo accounts (auto demo sessions are created
    // with flag=true; the reviewer account's flag can be reset to false).
    let cancelled = false;
    (async () => {
      let need = false;
      try {
        if (user) {
          // A completion recorded before the profile ever resolved (auth/me
          // failing right after signup) lands in a device-scoped flag; fold
          // it into this account's state BEFORE deciding, so the funnel can
          // never re-run.
          await adoptPendingDone(user.id);
          const local = await readOnboardingState(user.id);
          need = needsOnboarding(user, local);
          if (!need) {
            // Profile resolved and no onboarding due — drop any leftover
            // just-signed-up flag so it can't misroute a later account.
            clearFreshSignupFlag().catch(() => {});
          }
          // Completion finished offline earlier? Push the server flag now so a
          // reinstall on another device never re-onboards this account.
          if (local.localDone && !local.serverSynced) {
            api.completeOnboarding()
              .then(() => writeOnboardingState(user.id, { ...local, serverSynced: true }))
              .catch(() => {});
          }
        } else {
          // Profile not loaded yet — only a brand-new signup from THIS device
          // (flag set before login()) goes to onboarding without waiting.
          need = await hasFreshSignupFlag();
          // login() swallows a failed /auth/me and never retries on its own —
          // kick a best-effort refetch so `user` (and the authoritative
          // onboarding flag) still lands if that first fetch hiccuped. The
          // effect re-runs when it resolves; the onboarding screen itself
          // renders fine without a profile, so nothing blocks meanwhile.
          refreshUser().catch(() => {});
        }
      } catch {
        need = false;
      }
      if (cancelled) return;
      router.replace(need ? '/onboarding' : '/(tabs)');
    })();
    return () => { cancelled = true; };
  }, [token, isLoading, isDemo, user?.id, user?.onboarding_completed, user?.is_demo]);

  // On any session transition — logout (token cleared), demo exit, or demo
  // entry — wipe the IN-MEMORY query cache too. authContext already clears the
  // persisted on-disk copies; clearing the live cache here prevents the persist
  // subscriber from re-writing a previous session's data back to disk, stops a
  // different account from briefly seeing stale dashboards, and guarantees demo
  // data never survives into (or leaks out of) the sandbox.
  useEffect(() => {
    const prev = prevSession.current;
    if (prev !== sessionKey && (prev !== null || sessionKey === '__demo__')) {
      queryClient.clear();
    }
    prevSession.current = sessionKey;
  }, [sessionKey, queryClient]);

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

  // Drain the offline queues so synced data lands without the user ever having
  // to close + reopen the app. A drain runs on cold start, on foreground, on a
  // connectivity flip offline->online, the moment a write falls back to a queue
  // (requestDrain from api.ts), AND on a self-rescheduling backoff retry while
  // the app stays open and anything is still queued. Re-entrancy is guarded by
  // `draining` so overlapping triggers never fire two concurrent drains; on any
  // real flush we invalidate the dashboard lists so the synced rows appear.
  useEffect(() => {
    if (!token) return;

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = SYNC_RETRY_BASE_MS;
    let appActive = AppState.currentState === 'active';
    // Set by cleanup so a drain that finishes AFTER the effect is torn down
    // (token change / unmount) can't re-arm a stray retry timer from its finally.
    let disposed = false;

    const clearRetry = () => {
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    };

    // Re-arm a backoff retry only while foregrounded AND something is still
    // queued. Empties → stop and reset the backoff. This is what lets a write
    // that hit a transient hiccup (server reachable, so connectivity never
    // flipped to offline) finally sync with the app left open the whole time.
    const scheduleRetry = async () => {
      clearRetry();
      if (disposed || !appActive) return;
      const [createDepth, opDepth] = await Promise.all([getQueueDepth(), getOpQueueDepth()]);
      if (createDepth + opDepth === 0) { backoffMs = SYNC_RETRY_BASE_MS; return; }
      const delay = backoffMs;
      backoffMs = Math.min(backoffMs * 2, SYNC_RETRY_MAX_MS);
      retryTimer = setTimeout(() => { tryDrain(); }, delay);
    };

    const tryDrain = async () => {
      if (draining.current) return;
      draining.current = true;
      let changed = false;
      try {
        const [createDepth, opDepth] = await Promise.all([getQueueDepth(), getOpQueueDepth()]);

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
              upsertDailyGoal: (date, target) => api.upsertDailyGoalRaw(date, target),
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
          // Queued entries just reached the server, so the rollup the
          // foreground notification refresh fetched moments ago is already
          // stale — re-author the queued notifications with the post-drain
          // numbers. (Coalesced internally; suppressed calls run trailing.)
          refreshMotivationSchedule().catch(() => {});
        }
      } finally {
        setSyncing(false);
        draining.current = false;
        await refreshPendingCount();
        // A real flush means progress — retry the next hiccup fast.
        if (changed) backoffMs = SYNC_RETRY_BASE_MS;
        // Keep retrying on a backoff while anything is still queued and we're
        // foregrounded; this is the loop that drains without a close/reopen.
        scheduleRetry();
      }
    };
    // Re-arm the daily motivation notifications with the latest numbers. No-ops
    // when the feature is disabled. Runs alongside the queue drain so the
    // evening recap reflects data from the most recent app open.
    const refreshNotifs = () => { refreshMotivationSchedule().catch(() => {}); };

    tryDrain();
    refreshNotifs();
    const sub = AppState.addEventListener('change', (state) => {
      const nowActive = state === 'active';
      if (nowActive && !appActive) {
        // Returning to foreground — reset the backoff and try immediately.
        appActive = true;
        backoffMs = SYNC_RETRY_BASE_MS;
        tryDrain();
        refreshNotifs();
      } else if (!nowActive && appActive) {
        // Backgrounded — stop the retry loop; it resumes on the next foreground
        // (timers are throttled in the background anyway).
        appActive = false;
        clearRetry();
      }
    });
    // Also drain the instant connectivity flips from offline → online (the
    // health probe recovered), without waiting for a foreground event.
    let wasOnline = getSyncState().online;
    const unsubscribeSync = subscribeSync(() => {
      const nowOnline = getSyncState().online;
      if (nowOnline && !wasOnline) { backoffMs = SYNC_RETRY_BASE_MS; tryDrain(); }
      wasOnline = nowOnline;
    });
    // Let api.ts ask for a flush the moment a write is queued, instead of
    // waiting for a lifecycle/connectivity event. Reset the backoff so the very
    // next attempt is immediate.
    const unregisterDrain = registerDrainHandler(() => {
      backoffMs = SYNC_RETRY_BASE_MS;
      tryDrain();
    });
    return () => { disposed = true; sub.remove(); unsubscribeSync(); unregisterDrain(); clearRetry(); };
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
      if (isMotivationId(id)) {
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

  // Referral deep links: `earningsninja://referral/CODE`. When the user is
  // already signed in we redeem the code immediately (and refresh entitlements
  // so the referral attribution lands); when they're logged out we stash it so
  // the signup screen can prefill it. Runs regardless of auth state (unlike the
  // entry handler above) so the code is never lost for a logged-out invitee.
  useEffect(() => {
    if (isLoading) return;
    // Demo Mode: ignore referral links entirely. The sandbox is not "logged
    // out" — stashing a pending code here would persist demo-session input to
    // disk and pre-fill a later real signup.
    if (isDemo) return;
    const handle = async (url: string | null) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      // Accept both forms: the custom scheme (earningsninja://referral/CODE)
      // and the shared HTTPS invite page (https://<backend>/invite/CODE),
      // so a tapped invite link redeems directly if the app is installed.
      let rawCode = '';
      if (parsed.hostname === 'referral') {
        rawCode = parsed.path ?? '';
      } else {
        const m = (parsed.path ?? '').match(/^\/?invite\/([A-Za-z0-9]+)/);
        if (!m) return;
        rawCode = m[1];
      }
      const code = rawCode.replace(/^\/+|\/+$/g, '').trim().toUpperCase();
      if (!code) return;
      if (token) {
        try {
          await api.redeemReferral(code);
          await clearPendingReferral();
          await refreshSubscription();
        } catch {
          // Invalid / already-redeemed — surfaced in Settings, not here.
        }
      } else {
        await setPendingReferral(code);
      }
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [isLoading, token, isDemo, refreshSubscription]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: BG } }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="index" />
      </Stack>
      {isDemo && <DemoModeChrome />}
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
  // Mascot intro animation overlays the app once per cold start (native only —
  // on web it would just delay first paint). Starts false and is decided during
  // hydration (below) from the persisted Settings preference, so when the user
  // has turned it off the overlay never mounts — and when it's on, the decision
  // lands before the first render (the native splash is still up), so there's
  // no flash either way.
  const [showIntro, setShowIntro] = useState(false);
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web' && (await getIntroEnabled())) setShowIntro(true);
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
                  {showIntro && <IntroVideo onDone={() => setShowIntro(false)} />}
                </SubscriptionProvider>
              </AuthProvider>
            </HiddenModeProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
