import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { isDemoActive } from './demoSession';
import { HIDDEN_MODE_KEY, MASK } from './hiddenMode';
import {
  nextOccurrence, occurrenceAt, morningBody, eveningBody,
  futureMorningBody, futureEveningBody,
} from './notificationContent';

// ─── Motivation Notifications ────────────────────────────────────────────────
// Two local notifications per day: a morning motivation (9:00) and an evening
// recap (20:00), queued as a rolling 7-day window of one-shots re-armed on
// every app foreground and earnings mutation (see app/_layout.tsx). Day 0
// carries fresh sameDay-aware figures; days 1..6 carry number-safe rotating
// copy, so a driver who never opens the app still hears from us all week —
// without ever baking a stale volatile number into a future delivery.
//
// All content respects Hidden Mode: when the user has masked their numbers we
// never put a dollar figure in a notification (it could show on a lock screen
// in public), substituting MASK / number-free copy instead.

const NOTIF_ENABLED_KEY = 'notifications_enabled';

const MORNING_HOUR = 9;
const EVENING_HOUR = 20;

// Identifiers so we only ever touch our own scheduled notifications. Day 0 is
// the next occurrence (fresh, sameDay-aware content); days 1..N-1 carry
// number-safe rotating copy so nudges keep arriving even if the app is never
// opened again this week.
const MOTIVATION_PREFIX = 'motivation-';
const MORNING_ID = 'motivation-morning'; // day 0
const EVENING_ID = 'motivation-evening'; // day 0
const DAYS_AHEAD = 7;

// Tells the root notification listener whether a delivered notification is one
// of our motivation nudges (vs any other future local notification) before
// playing the ka-ching sound effect.
export function isMotivationId(id: string | null | undefined): boolean {
  return !!id && id.startsWith(MOTIVATION_PREFIX);
}

// Android requires a channel; importance DEFAULT shows a banner without
// bypassing DND. iOS ignores this. Fire-and-forget at module load — scheduling
// below references the channel by id.
const channelReady: Promise<unknown> = Platform.OS === 'android'
  ? Notifications.setNotificationChannelAsync('motivation', {
      name: 'Daily Motivation',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {})
  : Promise.resolve();

// Foreground display behaviour. Without a handler iOS suppresses banners while
// the app is in the foreground; we want the driver to see the nudge regardless.
// Wrapped so a native module init failure here (this runs at module import,
// i.e. during app startup) degrades to "no foreground banners" instead of
// crashing the launch.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  if (__DEV__) console.warn('[notifications] setNotificationHandler failed:', e);
}

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
    // Cancel by prefix so every queued day (and any legacy id) is cleared —
    // fixed-id cancellation would strand future-day notifications.
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => isMotivationId(n.identifier))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // No-op: cancelling a non-existent identifier is harmless.
  }
}

// Coalesce concurrent/rapid reschedules. `scheduling` is a mutex so two callers
// (e.g. foreground + a Hidden Mode toggle firing together) can't interleave the
// cancel/schedule pair; `lastRun` enforces a short cooldown so routine
// foregrounds don't fire a pair of rollup fetches on every app switch.
let scheduling = false;
let lastRun = 0;
const COOLDOWN_MS = 30_000;
// A refresh suppressed by the cooldown or mutex must not be DROPPED — that's
// how stale numbers used to survive (save → refresh swallowed → notification
// keeps the pre-save figure until the next foreground). Instead we remember
// the request and run one trailing refresh when the window opens, so the
// LATEST earnings always win.
let trailingTimer: ReturnType<typeof setTimeout> | null = null;
let trailingHidden: boolean | undefined;

function armTrailingRefresh(delayMs: number, hidden?: boolean): void {
  // Latest caller's hidden override wins (matches last-write semantics).
  if (hidden !== undefined) trailingHidden = hidden;
  if (trailingTimer) return; // one pending trailing run is enough — it fetches fresh data anyway
  trailingTimer = setTimeout(() => {
    trailingTimer = null;
    const h = trailingHidden;
    trailingHidden = undefined;
    refreshMotivationSchedule({ hidden: h, force: true }).catch(() => {});
  }, Math.max(delayMs, 250));
}

// Called after any earnings mutation confirms (entry create/edit/delete, goal
// change) so queued notification content always reflects the latest numbers.
// Cooldown-friendly: bursts of saves coalesce into at most one refresh per
// window plus one trailing refresh carrying the final state.
export function notifyEarningsChanged(): void {
  refreshMotivationSchedule().catch(() => {});
}

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
  // Local sandbox Demo Mode: never schedule notifications from demo data —
  // sample numbers must not land on a real lock screen (and the rollup fetch
  // would be served by the demo store anyway).
  if (isDemoActive()) return;
  if (!(await getNotifEnabled())) return;

  const now = Date.now();
  if (!opts?.force && now - lastRun < COOLDOWN_MS) {
    // Cooldown-suppressed: defer instead of dropping so the latest earnings
    // still land in the queued notifications once the window opens.
    armTrailingRefresh(lastRun + COOLDOWN_MS - now, opts?.hidden);
    return;
  }
  if (scheduling) {
    // Another refresh is mid-flight; a save that lands during its fetch would
    // otherwise be lost. Trail one more run to pick up the final state.
    armTrailingRefresh(500, opts?.hidden);
    return;
  }
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

  await channelReady;
  await cancelMotivation();

  const trigger = (date: Date): Notifications.NotificationTriggerInput => ({
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
    ...(Platform.OS === 'android' ? { channelId: 'motivation' } : null),
  });

  try {
    // Day 0: fresh, sameDay-aware content (live profit / goal figures).
    const morning = nextOccurrence(MORNING_HOUR);
    const evening = nextOccurrence(EVENING_HOUR);
    await Notifications.scheduleNotificationAsync({
      identifier: MORNING_ID,
      content: {
        title: 'Good morning, Ninja 🥷',
        body: morningBody(hidden, todayGoal, weekProfit, morning.sameDay),
      },
      trigger: trigger(morning.date),
    });
    await Notifications.scheduleNotificationAsync({
      identifier: EVENING_ID,
      content: {
        title: 'Evening recap 🌙',
        body: eveningBody(hidden, todayProfit, todayGoal, goalProgress, evening.sameDay, MASK),
      },
      trigger: trigger(evening.date),
    });

    // Days 1..N-1: number-safe rotating copy so the driver keeps hearing from
    // us for a full week even if the app is never opened. Every app open /
    // save re-arms the whole window, so day 0 is always the freshest.
    for (let d = 1; d < DAYS_AHEAD; d++) {
      const mDate = occurrenceAt(MORNING_HOUR, d);
      const eDate = occurrenceAt(EVENING_HOUR, d);
      await Notifications.scheduleNotificationAsync({
        identifier: `${MOTIVATION_PREFIX}morning-d${d}`,
        content: {
          title: 'Good morning, Ninja 🥷',
          body: futureMorningBody(hidden, todayGoal, mDate),
        },
        trigger: trigger(mDate),
      });
      await Notifications.scheduleNotificationAsync({
        identifier: `${MOTIVATION_PREFIX}evening-d${d}`,
        content: {
          title: 'Evening recap 🌙',
          body: futureEveningBody(eDate),
        },
        trigger: trigger(eDate),
      });
    }
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
  // Demo Mode: no OS permission prompt and no persisted preference — the
  // toggle would otherwise write device-wide state from the sandbox.
  if (isDemoActive()) return false;
  const granted = await ensureNotifPermission();
  if (!granted) return false;
  await setNotifEnabledFlag(true);
  await refreshMotivationSchedule({ hidden, force: true });
  return true;
}

export async function disableMotivation(): Promise<void> {
  // Demo Mode: never flip the real user's persisted preference or cancel
  // their scheduled notifications from the sandbox.
  if (isDemoActive()) return;
  await setNotifEnabledFlag(false);
  await cancelMotivation();
}

// The single source of truth for whether the feature is *actually* on: both the
// persisted intent AND a live OS permission grant. If permission was revoked out
// of band (Settings app) while the flag stayed on, self-heal by turning the flag
// off and cancelling, so the UI never claims notifications are on when iOS will
// silently drop them. Returns the reconciled enabled state.
export async function syncNotifState(): Promise<boolean> {
  // Demo Mode: report "off" without touching the persisted flag or schedules
  // (the self-heal below writes to disk).
  if (isDemoActive()) return false;
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
