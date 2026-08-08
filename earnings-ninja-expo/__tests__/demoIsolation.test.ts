// Regression tests for local sandbox Demo Mode isolation. The invariant:
// while a demo session is active, NOTHING demo-derived may be written to
// device storage (mirrors, preferences, persisted query cache, notification
// flags) and no request may leave the device — and exiting demo must leave
// any pre-existing real-account local data untouched.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { enterDemoSession, exitDemoSession, isDemoActive, DEMO_USER } from '../lib/demoSession';
import {
  writePlatformsMirror, readPlatformsMirror,
  writeLabelsMirror, writeEntryTypesMirror, writeExpenseCatsMirror, writeHiddenCatsMirror,
} from '../lib/platforms';
import { demoRollup, demoAllEntries, demoCreateEntry, demoDeleteEntry, resetDemoStore } from '../lib/demoStore';

afterEach(async () => {
  exitDemoSession();
  await AsyncStorage.clear();
});

describe('demo session lifecycle', () => {
  it('activates and deactivates the flag', () => {
    expect(isDemoActive()).toBe(false);
    enterDemoSession();
    expect(isDemoActive()).toBe(true);
    exitDemoSession();
    expect(isDemoActive()).toBe(false);
  });

  it('demo user carries no real identity and skips onboarding', () => {
    expect(DEMO_USER.is_demo).toBe(true);
    expect(DEMO_USER.onboarding_completed).toBe(true);
    expect(DEMO_USER.email).toMatch(/\.local$/);
  });
});

describe('storage mirror guards', () => {
  it('platform/label/type/category/hidden mirror writes are no-ops in demo', async () => {
    // Simulate a real account's pre-existing mirror.
    await writePlatformsMirror([{ id: 99, name: 'RealCo' }]);

    enterDemoSession();
    await writePlatformsMirror([{ id: 1, name: 'DemoLeak' }]);
    await writeLabelsMirror([{ kind: 'platform', key: 'DOORDASH', label: 'Leak' }]);
    await writeEntryTypesMirror([{ id: 1, name: 'Leak', kind: 'income' }]);
    await writeExpenseCatsMirror([{ id: 1, name: 'Leak' }]);
    await writeHiddenCatsMirror(['GAS']);
    exitDemoSession();

    // Real mirror unchanged; no demo keys written.
    expect(await readPlatformsMirror()).toEqual([{ id: 99, name: 'RealCo' }]);
    const keys = await AsyncStorage.getAllKeys();
    const values = await Promise.all(keys.map((k) => AsyncStorage.getItem(k)));
    expect(values.join('')).not.toContain('Leak');
    expect(values.join('')).not.toContain('GAS');
  });

  it('a full demo session (seed + edits) leaves AsyncStorage untouched', async () => {
    await AsyncStorage.setItem('real_marker', 'keep-me');
    const before = [...(await AsyncStorage.getAllKeys())].sort();

    enterDemoSession();
    const created = demoCreateEntry({ type: 'ORDER', app: 'DOORDASH', amount: 12.5 });
    demoDeleteEntry(created.id);
    exitDemoSession();

    const after = [...(await AsyncStorage.getAllKeys())].sort();
    expect(after).toEqual(before);
    expect(await AsyncStorage.getItem('real_marker')).toBe('keep-me');
  });
});

describe('notification guards', () => {
  it('enable/disable/sync never touch persisted state in demo', async () => {
    const { enableMotivation, disableMotivation, syncNotifState } = require('../lib/notifications');
    // Real user's persisted preference (key from lib/notifications.ts).
    await AsyncStorage.setItem('notifications_enabled', '1');

    enterDemoSession();
    expect(await enableMotivation()).toBe(false);
    await disableMotivation();
    expect(await syncNotifState()).toBe(false);
    exitDemoSession();

    // The real preference must survive the demo session untouched.
    expect(await AsyncStorage.getItem('notifications_enabled')).toBe('1');
  });
});

describe('device-wide preference guards (hidden mode / sound / intro)', () => {
  it('hidden-mode persist is a no-op in demo; real preference survives', async () => {
    const { persistHiddenModePref, HIDDEN_MODE_KEY } = require('../lib/hiddenMode');
    await AsyncStorage.setItem(HIDDEN_MODE_KEY, '1'); // real user hides earnings

    enterDemoSession();
    persistHiddenModePref(false); // demo toggles mask off
    exitDemoSession();
    await Promise.resolve(); // flush the fire-and-forget setItem (if any)

    expect(await AsyncStorage.getItem(HIDDEN_MODE_KEY)).toBe('1');
  });

  it('sound toggle is session-local in demo (no read, no write of the real key)', async () => {
    const { getSoundEnabled, setSoundEnabled, SOUND_ENABLED_KEY } = require('../lib/sound');
    await AsyncStorage.setItem(SOUND_ENABLED_KEY, '0'); // real user muted it

    enterDemoSession();
    expect(await getSoundEnabled()).toBe(true); // demo default, not the real '0'
    await setSoundEnabled(false);
    expect(await getSoundEnabled()).toBe(false); // session-local override works
    exitDemoSession();

    expect(await AsyncStorage.getItem(SOUND_ENABLED_KEY)).toBe('0'); // untouched
    expect(await getSoundEnabled()).toBe(false); // real pref honored again

    // Next demo session starts back at the default (override cleared).
    enterDemoSession();
    expect(await getSoundEnabled()).toBe(true);
  });

  it('intro toggle is session-local in demo (no read, no write of the real key)', async () => {
    const { getIntroEnabled, setIntroEnabled, INTRO_ENABLED_KEY } = require('../lib/introPref');
    await AsyncStorage.setItem(INTRO_ENABLED_KEY, '0'); // real user disabled it

    enterDemoSession();
    expect(await getIntroEnabled()).toBe(true); // demo default, not the real '0'
    await setIntroEnabled(false);
    expect(await getIntroEnabled()).toBe(false);
    exitDemoSession();

    expect(await AsyncStorage.getItem(INTRO_ENABLED_KEY)).toBe('0'); // untouched
    expect(await getIntroEnabled()).toBe(false); // real pref honored again
  });
});

describe('connectivity probe lifecycle', () => {
  it('an armed recovery probe is cancelled on demo entry and resumes on exit', () => {
    jest.useFakeTimers();
    const conn = require('../lib/connectivity');
    conn.initConnectivity('https://example.test/health');

    conn.reportFailure(); // offline before demo → probe interval armed
    expect(conn.isProbeArmed()).toBe(true);

    enterDemoSession();
    expect(conn.isProbeArmed()).toBe(false); // interval CANCELLED, not skipped
    conn.reportFailure(); // even a stray failure in demo must not re-arm
    expect(conn.isProbeArmed()).toBe(false);

    exitDemoSession();
    expect(conn.isProbeArmed()).toBe(true); // deliberate resume after sandbox

    conn.reportSuccess(); // cleanup: back online, probe stopped
    expect(conn.isProbeArmed()).toBe(false);
    jest.useRealTimers();
  });
});

describe('walkthrough / checklist / theme guards', () => {
  it('walkthrough seen-flags are session-local in demo and reset per session', async () => {
    const { readWalkthroughDone, resetWalkthrough } = require('../components/Walkthrough');
    await AsyncStorage.setItem('walkthrough_done:42', '1'); // real account's flag

    enterDemoSession();
    expect(await readWalkthroughDone('demo-local-sandbox')).toBe(false);
    await resetWalkthrough('demo-local-sandbox'); // settings replay path
    exitDemoSession();

    const keys = await AsyncStorage.getAllKeys();
    expect(keys.filter((k) => k.startsWith('walkthrough_done:'))).toEqual(['walkthrough_done:42']);
    expect(await AsyncStorage.getItem('walkthrough_done:42')).toBe('1');
  });

  it('add-entry walkthrough flags never touch the device in demo', async () => {
    const { readAddEntryWalkthroughDone, resetAddEntryWalkthrough } = require('../components/AddEntryWalkthrough');
    const before = [...(await AsyncStorage.getAllKeys())].sort();

    enterDemoSession();
    expect(await readAddEntryWalkthroughDone('demo-local-sandbox')).toBe(false);
    await resetAddEntryWalkthrough('demo-local-sandbox');
    exitDemoSession();

    expect([...(await AsyncStorage.getAllKeys())].sort()).toEqual(before);
  });

  it('getting-started restore in demo writes nothing to the device', async () => {
    const { restoreGettingStarted } = require('../components/GettingStarted');
    const before = [...(await AsyncStorage.getAllKeys())].sort();

    enterDemoSession();
    await restoreGettingStarted('demo-local-sandbox');
    exitDemoSession();

    expect([...(await AsyncStorage.getAllKeys())].sort()).toEqual(before);
  });
});

describe('report-a-problem draft guards', () => {
  it('read/save/clear are all no-ops in demo; a real draft survives untouched', async () => {
    const { readReportDraft, saveReportDraft, clearReportDraft } = require('../lib/reportDraft');
    const realDraft = { reportType: 'bug', title: 'Real', description: 'my real report', steps: '', email: 'me@x.com' };
    await AsyncStorage.setItem('problem-report-draft-v1', JSON.stringify(realDraft));

    enterDemoSession();
    // Sandbox must not see the real draft…
    expect(await readReportDraft()).toBeNull();
    // …must not overwrite it…
    await saveReportDraft({ reportType: 'bug', title: 'Demo', description: 'demo typed', steps: '', email: '' });
    // …and must not remove it (e.g. via the modal's success-path clearDraft).
    await clearReportDraft();
    exitDemoSession();

    expect(await readReportDraft()).toEqual(realDraft);
  });
});

describe('demo store behavior', () => {
  it('reseeds deterministically with realistic multi-platform data', () => {
    enterDemoSession();
    const first = demoAllEntries();
    expect(first.length).toBeGreaterThan(50);
    const apps = new Set(first.map((e) => e.custom_app ?? e.app));
    expect(apps.has('DOORDASH')).toBe(true);
    expect(apps.has('Spark')).toBe(true);

    // Mutate, then reset — the seed must come back identical in size.
    demoCreateEntry({ type: 'ORDER', app: 'UBEREATS', amount: 9.99 });
    resetDemoStore();
    expect(demoAllEntries().length).toBe(first.length);
  });

  it('rollup aggregation produces coherent KPIs with goal progress', () => {
    enterDemoSession();
    const r = demoRollup('THIS_MONTH');
    expect(r.profit).toBeCloseTo(r.revenue - r.expenses, 1);
    expect(r.revenue).toBeGreaterThan(0);
    expect(r.goal?.target_profit).toBeGreaterThan(0);
    expect(typeof r.goal_progress).toBe('number');
  });

  it('demo edits stay in memory and vanish on exit', () => {
    enterDemoSession();
    const n = demoAllEntries().length;
    demoCreateEntry({ type: 'BONUS', app: 'DOORDASH', amount: 20 });
    expect(demoAllEntries().length).toBe(n + 1);
    exitDemoSession();
    enterDemoSession();
    expect(demoAllEntries().length).toBe(n); // fresh seed, edit gone
  });
});
