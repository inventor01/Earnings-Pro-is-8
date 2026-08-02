import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppType, APP_LABELS, APP_COLORS, Entry, UserPlatform, LabelOverride } from './api';

// ---------------------------------------------------------------------------
// Built-in label overrides (per-user cosmetic renames of built-in pills)
// ---------------------------------------------------------------------------
// Kept in a module-level map so display helpers (entryAppLabel etc.) pick the
// override up everywhere without threading the map through every call site.
// The Add Entry screen refreshes it whenever the ['labelOverrides'] query (or
// its AsyncStorage mirror) resolves.

let PLATFORM_LABEL_OVERRIDES: Record<string, string> = {};
let TYPE_LABEL_OVERRIDES: Record<string, string> = {};

export function applyLabelOverrides(list: LabelOverride[]): void {
  const p: Record<string, string> = {};
  const t: Record<string, string> = {};
  for (const o of list) {
    if (!o || typeof o.key !== 'string' || typeof o.label !== 'string' || !o.label) continue;
    if (o.kind === 'platform') p[o.key] = o.label;
    else if (o.kind === 'type') t[o.key] = o.label;
  }
  PLATFORM_LABEL_OVERRIDES = p;
  TYPE_LABEL_OVERRIDES = t;
}

export function platformLabel(appKey: string): string {
  return PLATFORM_LABEL_OVERRIDES[appKey] ?? APP_LABELS[appKey as AppType] ?? appKey;
}

export function typeLabel(typeKey: string, fallback: string): string {
  return TYPE_LABEL_OVERRIDES[typeKey] ?? fallback;
}

const LABELS_MIRROR_KEY = 'labelOverridesMirror.v1';

export async function readLabelsMirror(): Promise<LabelOverride[]> {
  try {
    const raw = await AsyncStorage.getItem(LABELS_MIRROR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeLabelsMirror(list: LabelOverride[]): Promise<void> {
  try { await AsyncStorage.setItem(LABELS_MIRROR_KEY, JSON.stringify(list)); } catch {}
}

export async function clearLabelsMirror(): Promise<void> {
  try { await AsyncStorage.removeItem(LABELS_MIRROR_KEY); } catch {}
  applyLabelOverrides([]);
}

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
  return platformLabel(e.app);
}

// Distinct, readable palette for custom platform dots/avatars. Picked by a
// stable hash of the name so a platform keeps its color everywhere, forever.
// Also doubles as the preset swatch row in the platform editor.
export const CUSTOM_COLORS = [
  '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#3b82f6',
  '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#f59e0b',
];

// User-chosen styles (color/icon) keyed by lowercased platform name. Module-
// level (like the label overrides above) so display helpers used across the
// app — charts, calendar, entry rows — pick the chosen color up without
// threading the platform list through every call site. Refreshed whenever the
// ['platforms'] query (or its AsyncStorage mirror) resolves.
let PLATFORM_STYLES: Record<string, { color?: string | null; icon?: string | null }> = {};

export function applyPlatformStyles(list: UserPlatform[]): void {
  const next: typeof PLATFORM_STYLES = {};
  for (const p of list) {
    if (!p || typeof p.name !== 'string') continue;
    if (p.color || p.icon) next[p.name.trim().toLowerCase()] = { color: p.color, icon: p.icon };
  }
  PLATFORM_STYLES = next;
}

export function iconForCustomName(name: string): string | null {
  return PLATFORM_STYLES[name.trim().toLowerCase()]?.icon ?? null;
}

export function colorForCustomName(name: string): string {
  const chosen = PLATFORM_STYLES[name.trim().toLowerCase()]?.color;
  if (chosen) return chosen;
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
