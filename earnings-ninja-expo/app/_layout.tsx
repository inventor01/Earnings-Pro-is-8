import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { ThemeProvider } from '@/lib/theme';
import { HiddenModeProvider } from '@/lib/hiddenMode';
import { api } from '@/lib/api';
import { drainQueue, getQueueDepth } from '@/lib/offlineQueue';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function RootNav() {
  const { token, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const draining = useRef(false);

  useEffect(() => {
    if (!isLoading) {
      if (token) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    }
  }, [token, isLoading]);

  useEffect(() => {
    SplashScreen.hideAsync();
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
      const depth = await getQueueDepth();
      if (depth === 0) return;
      draining.current = true;
      try {
        const result = await drainQueue(api.createEntryRaw.bind(api));
        if (result.flushed > 0 || result.dropped > 0) {
          queryClient.invalidateQueries({ queryKey: ['entries'] });
          queryClient.invalidateQueries({ queryKey: ['rollup'] });
          queryClient.invalidateQueries({ queryKey: ['goal'] });
        }
      } finally {
        draining.current = false;
      }
    };
    tryDrain();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tryDrain();
    });
    return () => sub.remove();
  }, [token, queryClient]);

  // Deep links from the iOS widget land here. The widget tile fires
  // `earningsninja://entry/new` (and the QuickAddIntent uses the same scheme
  // when it falls back to opening the app). We forward into the dashboard
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
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="index" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <HiddenModeProvider>
              <AuthProvider>
                <StatusBar style="light" backgroundColor="#0a0a0a" />
                <RootNav />
              </AuthProvider>
            </HiddenModeProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
