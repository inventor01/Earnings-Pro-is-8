import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from './api';
import { APP_LABELS, APP_COLORS, type AppType } from './api';
import { customKey } from './platforms';

// ---------------------------------------------------------------------------
// Conversion onboarding funnel — pure state/helpers (unit-testable).
// The flow itself lives in app/onboarding.tsx. Server flag
// (`user.onboarding_completed`) is the cross-device/reinstall source of truth;
// this module adds a per-account local mirror so:
//  - killing the app mid-flow resumes at the saved step,
//  - completing offline sticks (localDone) until the server flag syncs,
//  - existing users NEVER see the flow (undefined server flag = completed).
// ---------------------------------------------------------------------------

export interface OnboardingState {
  /** Current step index (0-based) for mid-flow resume. */
  step: number;
  /** Selected gig-app keys (built-in AppType keys or extra display names). */
  apps: string[];
  /** Weekly income goal in dollars. */
  weeklyGoal: number;
  /** Chosen "biggest challenge" key, or null before the step is answered. */
  challenge: ChallengeKey | null;
  /** Flow finished locally (paywall shown) — never re-show even offline. */
  localDone: boolean;
  /** True once the server accepted completeOnboarding(). */
  serverSynced: boolean;
  /** Non-built-in platform names still awaiting a successful addPlatform(). */
  pendingPlatforms: string[];
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  step: 0,
  apps: [],
  weeklyGoal: 500,
  challenge: null,
  localDone: false,
  serverSynced: false,
  pendingPlatforms: [],
};

const KEY_PREFIX = 'onboarding.state.v1:';
// Set at signup time (before /auth/me resolves) so the router can send a
// brand-new account straight into onboarding without a dashboard flash.
const FRESH_SIGNUP_KEY = 'onboarding.freshSignup.v1';

function stateKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export async function readOnboardingState(userId: string): Promise<OnboardingState> {
  try {
    const raw = await AsyncStorage.getItem(stateKey(userId));
    if (!raw) return { ...DEFAULT_ONBOARDING_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_ONBOARDING_STATE, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULT_ONBOARDING_STATE };
  }
}

export async function writeOnboardingState(userId: string, state: OnboardingState): Promise<void> {
  try { await AsyncStorage.setItem(stateKey(userId), JSON.stringify(state)); } catch {}
}

export async function setFreshSignupFlag(): Promise<void> {
  try { await AsyncStorage.setItem(FRESH_SIGNUP_KEY, '1'); } catch {}
}

export async function clearFreshSignupFlag(): Promise<void> {
  try { await AsyncStorage.removeItem(FRESH_SIGNUP_KEY); } catch {}
}

export async function hasFreshSignupFlag(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(FRESH_SIGNUP_KEY)) === '1'; } catch { return false; }
}

// Completion recorded before the profile (and its user id) ever resolved —
// e.g. /auth/me kept failing right after signup. Device-scoped so the finish
// can never be lost; adopted into the per-account state on the next launch
// where the profile IS available, preventing any re-run of the funnel.
const PENDING_DONE_KEY = 'onboarding.pendingDone.v1';

export async function markPendingDoneWithoutUser(): Promise<void> {
  try { await AsyncStorage.setItem(PENDING_DONE_KEY, '1'); } catch {}
}

export async function adoptPendingDone(userId: string): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(PENDING_DONE_KEY)) !== '1') return;
    const s = await readOnboardingState(userId);
    await writeOnboardingState(userId, { ...s, localDone: true });
    await AsyncStorage.removeItem(PENDING_DONE_KEY);
  } catch {}
}

// Pure decision: should this user go through onboarding right now?
// FAIL CLOSED toward the dashboard: only an explicit server `false` with no
// local completion shows the flow. Existing users (flag true), old cached
// profiles / older servers (flag undefined), and a missing user all skip it.
// The server flag is authoritative even for demo accounts: normal demo
// accounts are created with the flag true (so they skip), but the App Store
// reviewer account's flag can be reset to false to demo the funnel.
export function needsOnboarding(
  user: Pick<User, 'is_demo' | 'onboarding_completed'> | null | undefined,
  local: Pick<OnboardingState, 'localDone'>,
): boolean {
  if (!user) return false;
  if (user.onboarding_completed !== false) return false;
  // Demo (reviewer) accounts re-run the funnel every login: ignore any local
  // completion marker left behind by an older build.
  if (user.is_demo) return true;
  return !local.localDone;
}

// ---------------------------------------------------------------------------
// Gig apps offered in the picker. Built-ins map to existing entry-form pills;
// the rest are created as the user's custom platforms so they appear in the
// entry form too.
// ---------------------------------------------------------------------------

export interface GigAppOption {
  /** Selection key: AppType for built-ins, display name for extras. */
  key: string;
  label: string;
  color: string;
  builtin: boolean;
}

const BUILTIN_ORDER: AppType[] = ['DOORDASH', 'UBEREATS', 'INSTACART', 'GRUBHUB', 'SHIPT'];
const EXTRA_APPS: { name: string; color: string }[] = [
  { name: 'Spark', color: '#0071dc' },
  { name: 'Uber', color: '#111111' },
  { name: 'Lyft', color: '#ea0b8c' },
  { name: 'Roadie', color: '#f97316' },
];

export const GIG_APP_OPTIONS: GigAppOption[] = [
  ...BUILTIN_ORDER.map((k) => ({ key: k, label: APP_LABELS[k], color: APP_COLORS[k], builtin: true })),
  ...EXTRA_APPS.map((e) => ({ key: e.name, label: e.name, color: e.color, builtin: false })),
];

// Pre-fill the Add Entry form's default platform from the onboarding
// selection. Writes the same AsyncStorage key the entry form reads for its
// "last used platform" auto-fill — seeded ONLY when empty, so a real last-used
// platform (written on every successful ORDER save) always wins over the seed.
const LAST_ORDER_APP_KEY = 'last_order_app'; // must match app/(tabs)/index.tsx

export async function seedDefaultPlatformFromOnboarding(apps: string[]): Promise<void> {
  try {
    const first = apps[0];
    if (!first) return;
    const existing = await AsyncStorage.getItem(LAST_ORDER_APP_KEY);
    if (existing) return;
    const builtinSet = new Set<string>(BUILTIN_ORDER);
    const key = builtinSet.has(first) ? first : customKey(first);
    await AsyncStorage.setItem(LAST_ORDER_APP_KEY, key);
  } catch {
    // Best-effort personalization — never block onboarding on it.
  }
}

// Split a selection into built-ins (already in the entry form) and custom
// platform names that must be created via the platforms API.
export function splitSelectedApps(selected: string[]): { builtins: string[]; customNames: string[] } {
  const builtinSet = new Set<string>(BUILTIN_ORDER);
  const builtins: string[] = [];
  const customNames: string[] = [];
  for (const key of selected) {
    if (builtinSet.has(key)) builtins.push(key);
    else customNames.push(key);
  }
  return { builtins, customNames };
}

// ---------------------------------------------------------------------------
// Weekly goal slider values ($300–$1500+).
// ---------------------------------------------------------------------------

export const GOAL_STOPS = [300, 500, 750, 1000, 1500] as const;

export function goalLabel(value: number): string {
  const max = GOAL_STOPS[GOAL_STOPS.length - 1];
  return value >= max ? `$${max.toLocaleString()}+` : `$${value.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Biggest-challenge options + the tailored "how we solve it" copy.
// ---------------------------------------------------------------------------

export type ChallengeKey =
  | 'not_enough'
  | 'expenses'
  | 'taxes'
  | 'tracking'
  | 'motivation';

export interface ChallengeOption {
  key: ChallengeKey;
  label: string;
  icon: string; // Ionicons name
}

export const CHALLENGE_OPTIONS: ChallengeOption[] = [
  { key: 'not_enough', label: 'Not making enough', icon: 'trending-down' },
  { key: 'expenses', label: 'Too many expenses', icon: 'wallet' },
  { key: 'taxes', label: 'Taxes', icon: 'document-text' },
  { key: 'tracking', label: 'Tracking my earnings', icon: 'list' },
  { key: 'motivation', label: 'Staying motivated', icon: 'flame' },
];

export interface SolutionCopy {
  title: string;
  sub: string;
  points: { icon: string; text: string }[];
}

// Copy for the belief-building screen, keyed by the chosen challenge. All
// claims describe real app features — nothing fabricated.
export function solutionForChallenge(challenge: ChallengeKey | null): SolutionCopy {
  switch (challenge) {
    case 'not_enough':
      return {
        title: 'Earn more from every hour you drive',
        sub: 'Earnings Ninja shows which apps, days, and hours actually pay you best.',
        points: [
          { icon: 'trending-up', text: 'See your real hourly pay after gas & miles' },
          { icon: 'sparkles', text: 'AI suggestions to earn more, drive less' },
          { icon: 'podium', text: 'Compare your apps side by side' },
        ],
      };
    case 'expenses':
      return {
        title: 'Stop letting expenses eat your profit',
        sub: 'Log gas, parking, and maintenance in seconds — and see what is truly left.',
        points: [
          { icon: 'wallet', text: 'One-tap expense logging by category' },
          { icon: 'trending-up', text: 'Real net profit, not just gross pay' },
          { icon: 'analytics', text: 'Spot the costs quietly draining your week' },
        ],
      };
    case 'taxes':
      return {
        title: 'Be ready when tax season hits',
        sub: 'Every dollar and deduction, organized all year — no shoebox of receipts.',
        points: [
          { icon: 'document-text', text: 'Year-round earnings & expense records' },
          { icon: 'download', text: 'Tax reports ready in one tap' },
          { icon: 'shield-checkmark', text: 'Never lose a deductible expense again' },
        ],
      };
    case 'motivation':
      return {
        title: 'Turn every shift into a game you can win',
        sub: 'Daily goals, streaks, and progress you can feel — right on your lock screen.',
        points: [
          { icon: 'flag', text: 'Daily & weekly goals that track themselves' },
          { icon: 'flame', text: 'Motivating progress updates as you earn' },
          { icon: 'phone-portrait', text: 'Widgets keep your goal in sight' },
        ],
      };
    case 'tracking':
    default:
      return {
        title: 'Every dollar, tracked in seconds',
        sub: 'Log an order in two taps — Earnings Ninja does the math across every app.',
        points: [
          { icon: 'flash', text: 'Two-tap logging, built for between deliveries' },
          { icon: 'cloud-offline', text: 'Works offline — syncs when you are back' },
          { icon: 'stats-chart', text: 'All your apps rolled into one dashboard' },
        ],
      };
  }
}

// Personalized paywall headline built from the weekly goal.
export function paywallHeadlineForGoal(weeklyGoal: number | null | undefined): string {
  if (!weeklyGoal || weeklyGoal <= 0) return 'Start earning\nsmarter today.';
  return `Let's help you hit\n${goalLabel(weeklyGoal)}/week.`;
}
