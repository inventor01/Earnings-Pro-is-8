import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppType, APP_LABELS, APP_COLORS, Entry, UserPlatform } from './api';

// ---------------------------------------------------------------------------
// Custom platform selection encoding
// ---------------------------------------------------------------------------
// The Add/Edit Entry platform selector holds a single string value. Built-in
// platforms use their AppType key ('DOORDASH', ...); user-created platforms
// are encoded as 'CUSTOM:<name>' so they can never collide with an enum key.
// On submit, a custom selection maps to { app: 'OTHER', custom_app: <name> }.

export const CUSTOM_PREFIX = 'CUSTOM:';

export function customKey(name: string): string {
  return `${CUSTOM_PREFIX}${name}`;
}

export function isCustomKey(key: string): boolean {
  return key.startsWith(CUSTOM_PREFIX);
}

export function customNameFromKey(key: string): string {
  return isCustomKey(key) ? key.slice(CUSTOM_PREFIX.length) : key;
}

// Selection key for an existing entry (edit prefill / last-used autofill).
export function keyForEntry(e: Pick<Entry, 'app' | 'custom_app'>): string {
  return e.custom_app ? customKey(e.custom_app) : e.app;
}

// ---------------------------------------------------------------------------
// Display helpers — work for BOTH built-in and custom platforms
// ---------------------------------------------------------------------------

export function entryAppLabel(e: Pick<Entry, 'app' | 'custom_app'>): string {
  if (e.custom_app) return e.custom_app;
  return APP_LABELS[e.app] ?? e.app;
}

// Distinct, readable palette for custom platform dots/avatars. Picked by a
// stable hash of the name so a platform keeps its color everywhere, forever.
const CUSTOM_COLORS = [
  '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#3b82f6',
  '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#f59e0b',
];

export function colorForCustomName(name: string): string {
  let h = 0;
  const s = name.toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CUSTOM_COLORS[h % CUSTOM_COLORS.length];
}

export function entryAppColor(e: Pick<Entry, 'app' | 'custom_app'>): string {
  if (e.custom_app) return colorForCustomName(e.custom_app);
  return APP_COLORS[e.app] ?? APP_COLORS.OTHER;
}

// ---------------------------------------------------------------------------
// AsyncStorage mirror — lets the platform list appear instantly on cold start
// (and offline) while React Query refetches the authoritative server list.
// ---------------------------------------------------------------------------

const MIRROR_KEY = 'customPlatformsMirror.v1';

export async function readPlatformsMirror(): Promise<UserPlatform[]> {
  try {
    const raw = await AsyncStorage.getItem(MIRROR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: any) => p && typeof p.id === 'number' && typeof p.name === 'string' && p.name.length > 0,
    );
  } catch {
    return [];
  }
}

export async function writePlatformsMirror(platforms: UserPlatform[]): Promise<void> {
  try {
    await AsyncStorage.setItem(MIRROR_KEY, JSON.stringify(platforms));
  } catch {}
}

export async function clearPlatformsMirror(): Promise<void> {
  try { await AsyncStorage.removeItem(MIRROR_KEY); } catch {}
}

// ---------------------------------------------------------------------------
// Client-side duplicate check (server enforces too — this gives instant UX).
// Case-insensitive against built-in labels/keys and the current custom list.
// ---------------------------------------------------------------------------

const BUILTIN_NAMES = new Set<string>([
  ...Object.keys(APP_LABELS).map(k => k.toLowerCase()),
  ...Object.values(APP_LABELS).map(l => l.toLowerCase()),
  'door dash', 'grub hub',
]);

export function findDuplicatePlatform(name: string, existing: UserPlatform[]): 'builtin' | 'custom' | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (BUILTIN_NAMES.has(n)) return 'builtin';
  if (existing.some(p => p.name.trim().toLowerCase() === n)) return 'custom';
  return null;
}

export const MAX_PLATFORM_NAME_LEN = 24;
