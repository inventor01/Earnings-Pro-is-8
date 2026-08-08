import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, User } from './api';
import { getToken, setToken as persistToken, clearToken } from './tokenStorage';
import { widgetSync } from './widgetSync';
import { clearLocalStore } from './localStore';
import { clearMutationQueue } from './mutationQueue';
import { clearQueue as clearCreateQueue } from './offlineQueue';
import { clearPersistedCache } from './queryPersist';
import {
  clearPlatformsMirror, clearLabelsMirror, clearEntryTypesMirror,
  clearExpenseCatsMirror, clearHiddenCatsMirror,
} from './platforms';
import { refreshPendingCount } from './pendingCount';
import { DEMO_USER, enterDemoSession, exitDemoSession, isDemoActive } from './demoSession';
import { setPersistSuspended } from './queryPersist';

// Wipe every device-local copy of the signed-in user's data: the entries/goals
// mirror, both offline queues, and the persisted React Query cache. Without this,
// logging out then signing in as a DIFFERENT account on the same device would
// leak the previous user's financial data (cold-start reads) and replay their
// queued writes under the new account. Best-effort and order-independent.
async function clearAllLocalData(): Promise<void> {
  await Promise.allSettled([
    clearLocalStore(),
    clearMutationQueue(),
    clearCreateQueue(),
    clearPersistedCache(),
    // Custom-platform + built-in label-override mirrors: without this a
    // different account signing in on the same device could inherit the
    // previous user's platform pills / renamed tab labels while offline.
    clearPlatformsMirror(),
    clearLabelsMirror(),
    // Same leak for custom entry types, custom expense categories, and hidden
    // built-in category keys.
    clearEntryTypesMirror(),
    clearExpenseCatsMirror(),
    clearHiddenCatsMirror(),
  ]);
  await refreshPendingCount();
}

// Cache the user profile (non-sensitive: id/email/username/name) so the app can
// show it on a cold start with no network. The auth TOKEN stays in SecureStore
// (tokenStorage); this is only the display profile.
const USER_CACHE_KEY = 'cached_user_v1';

async function readCachedUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

async function writeCachedUser(user: User | null): Promise<void> {
  try {
    if (user) await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else await AsyncStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // Best-effort cache; ignore storage failures.
  }
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  // Local sandbox Demo Mode: true while exploring with sample data. No token,
  // no network, nothing persisted — see lib/demoSession.ts.
  isDemo: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  // Refetch /auth/me and update the in-memory + cached user (after profile
  // changes like username/email edits). Best-effort: keeps existing state on
  // network failure.
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  isLoading: true,
  isDemo: false,
  enterDemo: () => {},
  exitDemo: () => {},
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  // Enter the local sandbox demo: synchronous, no network, no token, nothing
  // written to SecureStore/AsyncStorage. Persisting the React Query cache is
  // suspended so demo data can never be flushed to disk and inherited by a
  // later real login; any previously-persisted cache is cleared defensively.
  const enterDemo = () => {
    if (isDemoActive()) return;
    setPersistSuspended(true);
    clearPersistedCache().catch(() => {});
    enterDemoSession(); // reseeds the in-memory demo dataset
    setIsDemo(true);
    setUser({ ...DEMO_USER });
  };

  // Exit the demo and destroy all sandbox state. Nothing to clean up on disk —
  // the demo never wrote there — but clear the persisted cache again in case a
  // future persist path forgets to honor the suspension flag.
  const exitDemo = () => {
    if (!isDemoActive()) {
      setIsDemo(false);
      return;
    }
    exitDemoSession();
    setPersistSuspended(false);
    clearPersistedCache().catch(() => {});
    setIsDemo(false);
    setUser(null);
  };

  useEffect(() => {
    getToken().then(async (t) => {
      if (t) {
        setToken(t);
        // Re-push token to the iOS widget on cold-start. Without this the
        // widget only ever sees a token at explicit login(), so after an
        // app kill its quick-add tiles fall back to "Sign in" even though
        // SecureStore still has a valid token.
        widgetSync.onLogin(t);
        // Show the cached profile immediately so a cold start offline doesn't
        // render a blank/anonymous header while getMe() is failing.
        const cached = await readCachedUser();
        if (cached) setUser(cached);
        try {
          const u = await api.getMe();
          setUser(u);
          await writeCachedUser(u);
        } catch (err: any) {
          // Only force-logout if the server *explicitly* rejected the token
          // (401/403). On a transient network error, keep the token so the
          // next refetch can succeed — punishing the user for a flaky tunnel
          // means they have to re-log every time they open the app offline.
          const msg = String(err?.message ?? '');
          const isAuthFailure = /401|403|unauthor/i.test(msg);
          if (isAuthFailure) {
            await clearToken();
            await writeCachedUser(null);
            await clearAllLocalData();
            setToken(null);
            setUser(null);
            widgetSync.onLogout();
          }
        }
      }
      setIsLoading(false);
    });
  }, []);

  const login = async (newToken: string) => {
    // A real login always terminates any demo session first so the sandbox
    // user/entitlements can never bleed into the authenticated session.
    if (isDemoActive()) exitDemo();
    await persistToken(newToken);
    setToken(newToken);
    widgetSync.onLogin(newToken);
    try {
      const u = await api.getMe();
      setUser(u);
      await writeCachedUser(u);
    } catch {}
  };

  const refreshUser = async () => {
    try {
      const u = await api.getMe();
      setUser(u);
      await writeCachedUser(u);
    } catch {
      // Offline / transient failure — keep the current user state.
    }
  };

  const logout = async () => {
    // Demo Mode: "Sign Out" from Settings must ONLY end the sandbox. Running
    // the real cleanup below would wipe the device-local mirrors/queues of a
    // real account that signed out earlier expecting its offline data to sync
    // later — demo never wrote any of that, so there is nothing to clean.
    if (isDemoActive()) {
      exitDemo();
      return;
    }
    await clearToken();
    await writeCachedUser(null);
    await clearAllLocalData();
    setToken(null);
    setUser(null);
    widgetSync.onLogout();
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, isDemo, enterDemo, exitDemo, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
