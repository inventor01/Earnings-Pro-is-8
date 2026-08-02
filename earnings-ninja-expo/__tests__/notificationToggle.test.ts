// Covers the Settings "Daily Motivation" toggle turn-ON path end-to-end at the
// lib layer: enableMotivation must (1) request OS permission, (2) persist the
// enabled flag, (3) arm the full rolling 7-day schedule (14 notifications) —
// and must FAIL CLEANLY (return false, flag untouched, nothing mockScheduled) when
// permission is denied. Also locks in disable + the syncNotifState self-heal
// the toggle hydrates from when Settings opens.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// jest.mock factories may only close over `mock`-prefixed variables.
const mockScheduled: { identifier: string; content: any; trigger: any }[] = [];
const mockState = {
  perms: { granted: false, canAskAgain: true },
  requestResult: { granted: true },
};
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => mockState.perms),
  requestPermissionsAsync: jest.fn(async () => mockState.requestResult),
  scheduleNotificationAsync: jest.fn(async (req: any) => { mockScheduled.push(req); }),
  getAllScheduledNotificationsAsync: jest.fn(async () => mockScheduled.map(s => ({ identifier: s.identifier }))),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    const i = mockScheduled.findIndex(s => s.identifier === id);
    if (i >= 0) mockScheduled.splice(i, 1);
  }),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
}));

jest.mock('../lib/api', () => ({
  api: {
    getRollup: jest.fn(async () => ({ profit: 42, goal: { target_profit: 100 }, goal_progress: 0.42 })),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  enableMotivation, disableMotivation, syncNotifState, getNotifEnabled,
} from '../lib/notifications';

beforeEach(async () => {
  mockScheduled.length = 0;
  mockState.perms = { granted: false, canAskAgain: true };
  mockState.requestResult = { granted: true };
  (Notifications.requestPermissionsAsync as jest.Mock).mockClear();
  await AsyncStorage.clear();
});

describe('enableMotivation (Settings toggle ON)', () => {
  it('requests permission, persists the flag, and arms the full 7-day window', async () => {
    const ok = await enableMotivation();
    expect(ok).toBe(true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(await getNotifEnabled()).toBe(true);
    // 2 per day × 7 days
    expect(mockScheduled).toHaveLength(14);
    const ids = mockScheduled.map(s => s.identifier);
    expect(ids).toContain('motivation-morning');
    expect(ids).toContain('motivation-evening');
    expect(ids).toContain('motivation-morning-d6');
    expect(ids).toContain('motivation-evening-d6');
    expect(ids.every(id => id.startsWith('motivation-'))).toBe(true);
  });

  it('skips the permission prompt when already granted', async () => {
    mockState.perms = { granted: true, canAskAgain: true };
    const ok = await enableMotivation();
    expect(ok).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockScheduled).toHaveLength(14);
  });

  it('returns false and schedules nothing when the user denies permission', async () => {
    mockState.requestResult = { granted: false };
    const ok = await enableMotivation();
    expect(ok).toBe(false);
    expect(await getNotifEnabled()).toBe(false);
    expect(mockScheduled).toHaveLength(0);
  });

  it('returns false without prompting when iOS will not re-ask (canAskAgain=false)', async () => {
    mockState.perms = { granted: false, canAskAgain: false };
    const ok = await enableMotivation();
    expect(ok).toBe(false);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockScheduled).toHaveLength(0);
  });
});

describe('disableMotivation (Settings toggle OFF)', () => {
  it('clears the flag and cancels every queued motivation notification', async () => {
    await enableMotivation();
    expect(mockScheduled).toHaveLength(14);
    await disableMotivation();
    expect(await getNotifEnabled()).toBe(false);
    expect(mockScheduled).toHaveLength(0);
  });
});

describe('syncNotifState (toggle hydration when Settings opens)', () => {
  it('reports ON when the flag is set and permission still granted', async () => {
    await enableMotivation();
    mockState.perms = { granted: true, canAskAgain: true };
    expect(await syncNotifState()).toBe(true);
  });

  it('self-heals to OFF (and cancels) when permission was revoked in iOS Settings', async () => {
    await enableMotivation();
    mockState.perms = { granted: false, canAskAgain: false };
    expect(await syncNotifState()).toBe(false);
    expect(await getNotifEnabled()).toBe(false);
    expect(mockScheduled).toHaveLength(0);
  });

  it('reports OFF when the feature was never enabled', async () => {
    expect(await syncNotifState()).toBe(false);
  });
});
