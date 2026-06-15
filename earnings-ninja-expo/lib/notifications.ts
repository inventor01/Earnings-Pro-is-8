import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { HIDDEN_MODE_KEY, MASK } from './hiddenMode';

// ─── Motivation Notifications ────────────────────────────────────────────────
// Two local notifications per day: a morning motivation (9:00) and an evening
// recap (20:00). Both are scheduled as next-occurrence one-shots and re-armed
// on every app foreground (see app/_layout.tsx). One-shots (rather than DAILY
// repeats) keep the "today" framing honest: the recap always reflects the data
// from the last time the app was open, never a stale yesterday number baked into
// a forever-repeating trigger. The tradeoff is that a driver who never opens the
// app on a given day only receives the already-queued next occurrence.
//
// All content respects Hidden Mode: when the user has masked their numbers we
// never put a dollar figure in a notification (it could show on a lock screen
// in public), substituting MASK / number-free copy instead.

const NOTIF_ENABLED_KEY = 'notifications_enabled';

const MORNING_HOUR = 9;
const EVENING_HOUR = 20;

// Identifiers so we only ever touch our own scheduled notifications.
const MORNING_ID = 'motivation-morning';
const EVENING_ID = 'motivation-evening';

// The full set of motivation-notification identifiers. Exported so the root
// notification listener can tell our motivation nudges apart from any other
// (future) local notification before playing the ka-ching sound effect.
export const MOTIVATION_IDS: string[] = [MORNING_ID, EVENING_ID];

// Foreground display behaviour. Without a handler iOS suppresses banners while
// the app is in the foreground; we want the driver to see the nudge regardless.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getNotifEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(NOTIF_ENABLED_KEY)) === '1';
  } catch {
    return false;
  }
}

async function setNotifEnabledFlag(v: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_ENABLED_KEY, v ? '1' : '0');
  } catch {
    // Best-effort persistence; a failed write just means the toggle won't
    // survive a restart, which is non-fatal for a motivational feature.
  }
}

async function isHidden(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(HIDDEN_MODE_KEY)) === '1';
  } catch {
    return false;
  }
}

// Request OS permission. Returns true only if the user has granted (or already
// granted) notification permission.
export async function ensureNotifPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

export async function cancelMotivation(): Promise<void> {
  try {
    await Promise.all([
      Notifications.cancelScheduledNotificationAsync(MORNING_ID),
      Notifications.cancelScheduledNotificationAsync(EVENING_ID),
    ]);
  } catch {
    // No-op: cancelling a non-existent identifier is harmless.
  }
}

// Next clock occurrence of the given hour today, or tomorrow if it has passed.
function nextOccurrence(hour: number): Date {
  const now = new Date();
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

const usd = (n: number) => `$${Math.round(n)}`;

function morningBody(hidden: boolean, todayGoal: number, weekProfit: number): string {
  if (hidden) return 'Time to hit the road 🔥 Every order counts.';
  if (weekProfit > 0) return `Strong week so far: ${usd(weekProfit)} 💪 Let's add to it today 🔥`;
  if (todayGoal > 0) return `Today's goal: ${usd(todayGoal)} 🎯 Let's get it 🔥`;
  return 'Time to hit the road 🔥 Let\u2019s stack some orders.';
}

function eveningBody(
  hidden: boolean,
  todayProfit: number,
  todayGoal: number,
  goalProgress: number | null,
): string {
  if (hidden) return `Strong day on the road 🔥 Open the app to see your ${MASK}.`;
  const base = `You're crushing it! +${usd(todayProfit)} today 🔥`;
  if (todayGoal > 0) {
    if ((goalProgress ?? 0) >= 1) return `${base} Goal smashed! 🎉`;
    const remaining = todayGoal - todayProfit;
    if (remaining > 0) return `${base} Only ${usd(remaining)} to your goal 💪`;
  }
  return base;
}

// Coalesce concurrent/rapid reschedules. `scheduling` is a mutex so two callers
// (e.g. foreground + a Hidden Mode toggle firing together) can't interleave the
// cancel/schedule pair; `lastRun` enforces a short cooldown so routine
// foregrounds don't fire a pair of rollup fetches on every app switch.
let scheduling = false;
let lastRun = 0;
const COOLDOWN_MS = 30_000;

// Cancel and re-arm both motivation notifications using the latest data. Safe to
// call often (every foreground): it no-ops when the feature is disabled, and the
// network fetch failing just falls back to number-free copy.
//
// `opts.hidden` lets a caller that already knows the Hidden Mode state (it lives
// in the React tree) pass it in, avoiding an AsyncStorage read race right after a
// toggle. `opts.force` bypasses the cooldown — used when Hidden Mode changes (we
// must re-author masked content immediately so no dollar figure lingers on a
// lock screen) and when the feature is first enabled.
export async function refreshMotivationSchedule(
  opts?: { hidden?: boolean; force?: boolean },
): Promise<void> {
  if (!(await getNotifEnabled())) return;

  const now = Date.now();
  if (!opts?.force && now - lastRun < COOLDOWN_MS) return;
  if (scheduling) return;
  scheduling = true;
  lastRun = now;
  try {
    await doReschedule(opts?.hidden);
  } finally {
    scheduling = false;
  }
}

async function doReschedule(hiddenOverride?: boolean): Promise<void> {
  const hidden = hiddenOverride ?? (await isHidden());

  let todayProfit = 0;
  let todayGoal = 0;
  let goalProgress: number | null = null;
  let weekProfit = 0;
  try {
    const [today, week] = await Promise.all([
      api.getRollup('TODAY'),
      api.getRollup('THIS_WEEK'),
    ]);
    todayProfit = today.profit ?? 0;
    todayGoal = today.goal?.target_profit ?? 0;
    goalProgress = today.goal_progress ?? null;
    weekProfit = week.profit ?? 0;
  } catch {
    // Leave defaults; content falls back to generic encouragement.
  }

  await cancelMotivation();

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: MORNING_ID,
      content: {
        title: 'Good morning, Ninja 🥷',
        body: morningBody(hidden, todayGoal, weekProfit),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextOccurrence(MORNING_HOUR),
      },
    });
    await Notifications.scheduleNotificationAsync({
      identifier: EVENING_ID,
      content: {
        title: 'Evening recap 🌙',
        body: eveningBody(hidden, todayProfit, todayGoal, goalProgress),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextOccurrence(EVENING_HOUR),
      },
    });
  } catch {
    // Scheduling can throw if permission was revoked out from under us; the
    // Settings toggle re-checks permission on next enable.
  }
}

// Turn the feature on: request permission, persist the flag, arm the schedule.
// Returns false if permission was denied so the caller can surface guidance.
// `hidden` is passed through so the very first schedule already respects Hidden
// Mode without waiting for a foreground refresh.
export async function enableMotivation(hidden?: boolean): Promise<boolean> {
  const granted = await ensureNotifPermission();
  if (!granted) return false;
  await setNotifEnabledFlag(true);
  await refreshMotivationSchedule({ hidden, force: true });
  return true;
}

export async function disableMotivation(): Promise<void> {
  await setNotifEnabledFlag(false);
  await cancelMotivation();
}

// The single source of truth for whether the feature is *actually* on: both the
// persisted intent AND a live OS permission grant. If permission was revoked out
// of band (Settings app) while the flag stayed on, self-heal by turning the flag
// off and cancelling, so the UI never claims notifications are on when iOS will
// silently drop them. Returns the reconciled enabled state.
export async function syncNotifState(): Promise<boolean> {
  if (!(await getNotifEnabled())) return false;
  try {
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) {
      await disableMotivation();
      return false;
    }
  } catch {
    // Can't query permission — trust the persisted flag rather than nuke it.
    return true;
  }
  return true;
}
