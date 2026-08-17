import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppType, APP_LABELS, APP_COLORS, Entry, UserPlatform, UserEntryType, UserExpenseCategory, LabelOverride } from './api';
import { isDemoActive } from './demoSession';

// Local sandbox Demo Mode isolation: the dashboard writes these mirrors on
// every successful platforms/labels/types/categories query, and in demo those
// queries are served from the in-memory demo store. Persisting them would leak
// demo pills/labels into the NEXT real account on this device — so all mirror
// writes are no-ops while a demo session is active.

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
  if (isDemoActive()) return;
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
// Minimum-visible validation — shared by platform and category hide flows
// ---------------------------------------------------------------------------
// Validates the RESULTING state: how many selectable options would remain
// AFTER hiding `keyToHide`. Never trust the current on-screen pill count —
// the pill row deliberately keeps showing an already-hidden option while it
// is the current selection, so screen count ≠ true visible count. Hiding an
// already-hidden key is a no-op and must not change the outcome.
export function canHideBuiltin(
  builtinKeys: readonly string[],
  hiddenKeys: readonly string[],
  keyToHide: string,
  customCount: number,
  minimumVisible = 1,
): { allowed: boolean; remainingVisibleCount: number } {
  const nextHidden = new Set([...hiddenKeys, keyToHide]);
  const remainingVisibleCount =
    builtinKeys.filter(k => !nextHidden.has(k)).length + Math.max(0, customCount);
  return { allowed: remainingVisibleCount >= minimumVisible, remainingVisibleCount };
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
// DO NOT reorder/resize: hash % length must stay stable or every auto-colored
// platform silently changes color. The editor swatch grid uses PRESET_COLORS.
export const CUSTOM_COLORS = [
  '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#3b82f6',
  '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#f59e0b',
];

// Expanded preset palette for the Add/Edit editors (platforms, entry types,
// expense categories). 28 well-spaced hues, each with a spoken name for
// VoiceOver/TalkBack. Any hex the server already stores that isn't in this
// list still renders fine — presets only gate NEW picks, never old ones.
export const PRESET_COLORS: { hex: string; name: string }[] = [
  { hex: '#ef4444', name: 'Red' },
  { hex: '#e11d48', name: 'Rose' },
  { hex: '#f87171', name: 'Coral' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#eab308', name: 'Yellow' },
  { hex: '#84cc16', name: 'Lime' },
  { hex: '#22c55e', name: 'Green' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#14b8a6', name: 'Teal' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#0ea5e9', name: 'Sky Blue' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#1d4ed8', name: 'Dark Blue' },
  { hex: '#6366f1', name: 'Indigo' },
  { hex: '#8b5cf6', name: 'Violet' },
  { hex: '#a855f7', name: 'Purple' },
  { hex: '#c026d3', name: 'Magenta' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#fb7185', name: 'Light Rose' },
  { hex: '#92400e', name: 'Brown' },
  { hex: '#b45309', name: 'Caramel' },
  { hex: '#166534', name: 'Forest Green' },
  { hex: '#0f766e', name: 'Deep Teal' },
  { hex: '#6b7280', name: 'Gray' },
  { hex: '#475569', name: 'Slate' },
  { hex: '#94a3b8', name: 'Silver' },
  { hex: '#111827', name: 'Black' },
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
  if (isDemoActive()) return;
  try {
    await AsyncStorage.setItem(MIRROR_KEY, JSON.stringify(platforms));
  } catch {}
}

export async function clearPlatformsMirror(): Promise<void> {
  try { await AsyncStorage.removeItem(MIRROR_KEY); } catch {}
}

// ---------------------------------------------------------------------------
// Custom EARNINGS TYPES (the Type row) — mirrors the custom-platform design.
// Selector keys are 'CUSTOMTYPE:<name>'; on submit a custom selection maps to
// a BASE enum type (BONUS for income, EXPENSE for expense) + custom_type name,
// so all sign rules, rollups, and older clients keep working.
// ---------------------------------------------------------------------------

export const CUSTOM_TYPE_PREFIX = 'CUSTOMTYPE:';

export function customTypeKey(name: string): string {
  return `${CUSTOM_TYPE_PREFIX}${name}`;
}

export function isCustomTypeKey(key: string): boolean {
  return key.startsWith(CUSTOM_TYPE_PREFIX);
}

export function customTypeNameFromKey(key: string): string {
  return isCustomTypeKey(key) ? key.slice(CUSTOM_TYPE_PREFIX.length) : key;
}

// Selection key for an existing entry (edit prefill).
export function typeKeyForEntry(e: Pick<Entry, 'type' | 'custom_type'>): string {
  return e.custom_type ? customTypeKey(e.custom_type) : e.type;
}

// Display name for an entry's type (custom name wins over the enum label).
export function entryTypeLabel(e: Pick<Entry, 'type' | 'custom_type'>, fallback: string): string {
  if (e.custom_type) return e.custom_type;
  return typeLabel(e.type, fallback);
}

// Style registry for custom types (color/icon), separate from platforms so a
// type named like a platform can't inherit its styling by accident.
let ENTRY_TYPE_STYLES: Record<string, { color?: string | null; icon?: string | null }> = {};

export function applyEntryTypeStyles(list: UserEntryType[]): void {
  const next: typeof ENTRY_TYPE_STYLES = {};
  for (const t of list) {
    if (!t || typeof t.name !== 'string') continue;
    if (t.color || t.icon) next[t.name.trim().toLowerCase()] = { color: t.color, icon: t.icon };
  }
  ENTRY_TYPE_STYLES = next;
}

export function colorForCustomTypeName(name: string): string {
  const chosen = ENTRY_TYPE_STYLES[name.trim().toLowerCase()]?.color;
  if (chosen) return chosen;
  let h = 0;
  const s = name.toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CUSTOM_COLORS[h % CUSTOM_COLORS.length];
}

const TYPES_MIRROR_KEY = 'customEntryTypesMirror.v1';

export async function readEntryTypesMirror(): Promise<UserEntryType[]> {
  try {
    const raw = await AsyncStorage.getItem(TYPES_MIRROR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t: any) => t && typeof t.id === 'number' && typeof t.name === 'string' && t.name.length > 0,
    );
  } catch {
    return [];
  }
}

export async function writeEntryTypesMirror(types: UserEntryType[]): Promise<void> {
  if (isDemoActive()) return;
  try {
    await AsyncStorage.setItem(TYPES_MIRROR_KEY, JSON.stringify(types));
  } catch {}
}

export async function clearEntryTypesMirror(): Promise<void> {
  try { await AsyncStorage.removeItem(TYPES_MIRROR_KEY); } catch {}
}

const BUILTIN_TYPE_NAMES = new Set<string>(['order', 'bonus', 'expense', 'cancellation', 'tip', 'tips']);

export function findDuplicateEntryType(name: string, existing: UserEntryType[]): 'builtin' | 'custom' | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (BUILTIN_TYPE_NAMES.has(n)) return 'builtin';
  if (existing.some(t => t.name.trim().toLowerCase() === n)) return 'custom';
  return null;
}

// ---------------------------------------------------------------------------
// Custom EXPENSE CATEGORIES (the Category row on EXPENSE entries) — mirrors
// the custom-type design. Selector keys are 'CUSTOMCAT:<name>'; on submit a
// custom selection maps to the safe enum category 'OTHER' + custom_category
// name, so rollups and older clients keep working. Built-in categories can
// also be hidden per user (cosmetic — stored entries untouched).
// ---------------------------------------------------------------------------

export const CUSTOM_CAT_PREFIX = 'CUSTOMCAT:';

export function customCatKey(name: string): string {
  return `${CUSTOM_CAT_PREFIX}${name}`;
}

export function isCustomCatKey(key: string): boolean {
  return key.startsWith(CUSTOM_CAT_PREFIX);
}

export function customCatNameFromKey(key: string): string {
  return isCustomCatKey(key) ? key.slice(CUSTOM_CAT_PREFIX.length) : key;
}

// Selection key for an existing entry (edit prefill).
export function catKeyForEntry(e: Pick<Entry, 'category' | 'custom_category'>): string {
  return e.custom_category ? customCatKey(e.custom_category) : (e.category ?? 'OTHER');
}

// Display name for an entry's category (custom name wins over the enum value).
export function entryCategoryLabel(e: Pick<Entry, 'category' | 'custom_category'>): string {
  return e.custom_category || (e.category ?? 'OTHER');
}

const CATS_MIRROR_KEY = 'customExpenseCatsMirror.v1';
const HIDDEN_CATS_MIRROR_KEY = 'hiddenExpenseCatsMirror.v1';

export async function readExpenseCatsMirror(): Promise<UserExpenseCategory[]> {
  try {
    const raw = await AsyncStorage.getItem(CATS_MIRROR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t: any) => t && typeof t.id === 'number' && typeof t.name === 'string' && t.name.length > 0,
    );
  } catch {
    return [];
  }
}

export async function writeExpenseCatsMirror(cats: UserExpenseCategory[]): Promise<void> {
  if (isDemoActive()) return;
  try { await AsyncStorage.setItem(CATS_MIRROR_KEY, JSON.stringify(cats)); } catch {}
}

export async function clearExpenseCatsMirror(): Promise<void> {
  try { await AsyncStorage.removeItem(CATS_MIRROR_KEY); } catch {}
}

export async function readHiddenCatsMirror(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HIDDEN_CATS_MIRROR_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k: any) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

export async function writeHiddenCatsMirror(keys: string[]): Promise<void> {
  if (isDemoActive()) return;
  try { await AsyncStorage.setItem(HIDDEN_CATS_MIRROR_KEY, JSON.stringify(keys)); } catch {}
}

export async function clearHiddenCatsMirror(): Promise<void> {
  try { await AsyncStorage.removeItem(HIDDEN_CATS_MIRROR_KEY); } catch {}
}

// Hidden BUILT-IN platform / type pills — same mirror pattern as categories.
const HIDDEN_PLATFORMS_MIRROR_KEY = 'hiddenPlatformsMirror.v1';
const HIDDEN_TYPES_MIRROR_KEY = 'hiddenEntryTypesMirror.v1';

async function readStringListMirror(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k: any) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

export async function readHiddenPlatformsMirror(): Promise<string[]> {
  return readStringListMirror(HIDDEN_PLATFORMS_MIRROR_KEY);
}

export async function writeHiddenPlatformsMirror(keys: string[]): Promise<void> {
  if (isDemoActive()) return;
  try { await AsyncStorage.setItem(HIDDEN_PLATFORMS_MIRROR_KEY, JSON.stringify(keys)); } catch {}
}

export async function clearHiddenPlatformsMirror(): Promise<void> {
  try { await AsyncStorage.removeItem(HIDDEN_PLATFORMS_MIRROR_KEY); } catch {}
}

export async function readHiddenTypesMirror(): Promise<string[]> {
  return readStringListMirror(HIDDEN_TYPES_MIRROR_KEY);
}

export async function writeHiddenTypesMirror(keys: string[]): Promise<void> {
  if (isDemoActive()) return;
  try { await AsyncStorage.setItem(HIDDEN_TYPES_MIRROR_KEY, JSON.stringify(keys)); } catch {}
}

export async function clearHiddenTypesMirror(): Promise<void> {
  try { await AsyncStorage.removeItem(HIDDEN_TYPES_MIRROR_KEY); } catch {}
}

const BUILTIN_CAT_NAMES = new Set<string>([
  'gas', 'parking', 'tolls', 'maintenance', 'phone', 'subscription', 'food', 'leisure', 'charity', 'other',
]);

export function findDuplicateExpenseCat(name: string, existing: UserExpenseCategory[]): 'builtin' | 'custom' | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (BUILTIN_CAT_NAMES.has(n)) return 'builtin';
  if (existing.some(c => c.name.trim().toLowerCase() === n)) return 'custom';
  return null;
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
