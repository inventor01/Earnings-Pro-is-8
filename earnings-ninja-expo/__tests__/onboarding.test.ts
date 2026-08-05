jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  needsOnboarding,
  readOnboardingState,
  writeOnboardingState,
  markPendingDoneWithoutUser,
  adoptPendingDone,
  splitSelectedApps,
  goalLabel,
  paywallHeadlineForGoal,
  solutionForChallenge,
  GIG_APP_OPTIONS,
  GOAL_STOPS,
  CHALLENGE_OPTIONS,
  DEFAULT_ONBOARDING_STATE,
} from '../lib/onboarding';

const notDone = { localDone: false };
const done = { localDone: true };

describe('needsOnboarding', () => {
  it('shows onboarding only for a fresh signup with an explicit false flag', () => {
    expect(needsOnboarding({ is_demo: false, onboarding_completed: false }, notDone)).toBe(true);
  });

  it('never shows for existing users (flag true)', () => {
    expect(needsOnboarding({ is_demo: false, onboarding_completed: true }, notDone)).toBe(false);
  });

  it('fails closed when the flag is missing (old cached profile / older server)', () => {
    expect(needsOnboarding({ is_demo: false }, notDone)).toBe(false);
    expect(needsOnboarding({}, notDone)).toBe(false);
  });

  it('treats demo accounts like real ones (funnel shows once, completion sticks)', () => {
    // Skip when the server flag is already true.
    expect(needsOnboarding({ is_demo: true, onboarding_completed: true }, notDone)).toBe(false);
    // Fresh demo session (new account, flag false, no local state) shows the funnel.
    expect(needsOnboarding({ is_demo: true, onboarding_completed: false }, notDone)).toBe(true);
    // Completing it sticks: an app relaunch mid-session never re-runs the funnel.
    expect(needsOnboarding({ is_demo: true, onboarding_completed: false }, { localDone: true })).toBe(false);
  });

  it('never shows when there is no user', () => {
    expect(needsOnboarding(null, notDone)).toBe(false);
    expect(needsOnboarding(undefined, notDone)).toBe(false);
  });

  it('does not re-show after a local completion (offline finish sticks)', () => {
    expect(needsOnboarding({ is_demo: false, onboarding_completed: false }, done)).toBe(false);
  });
});

describe('splitSelectedApps', () => {
  it('separates built-in AppType keys from custom platform names', () => {
    const { builtins, customNames } = splitSelectedApps(['DOORDASH', 'Spark', 'UBEREATS', 'Roadie']);
    expect(builtins).toEqual(['DOORDASH', 'UBEREATS']);
    expect(customNames).toEqual(['Spark', 'Roadie']);
  });

  it('handles an empty selection', () => {
    expect(splitSelectedApps([])).toEqual({ builtins: [], customNames: [] });
  });

  it('classifies every offered gig app option', () => {
    const all = GIG_APP_OPTIONS.map((o) => o.key);
    const { builtins, customNames } = splitSelectedApps(all);
    expect(builtins.length + customNames.length).toBe(all.length);
    for (const o of GIG_APP_OPTIONS) {
      expect(o.builtin ? builtins : customNames).toContain(o.key);
    }
  });
});

describe('goalLabel', () => {
  it('formats normal stops as plain dollars', () => {
    expect(goalLabel(300)).toBe('$300');
    expect(goalLabel(1000)).toBe('$1,000');
  });

  it('renders the top stop as a plus value', () => {
    expect(goalLabel(GOAL_STOPS[GOAL_STOPS.length - 1])).toBe('$1,500+');
    expect(goalLabel(2000)).toBe('$1,500+');
  });
});

describe('paywallHeadlineForGoal', () => {
  it('personalizes the headline with the weekly goal', () => {
    expect(paywallHeadlineForGoal(500)).toContain('$500/week');
  });

  it('falls back to neutral copy without a goal', () => {
    expect(paywallHeadlineForGoal(0)).toContain('smarter');
    expect(paywallHeadlineForGoal(null)).toContain('smarter');
  });
});

describe('solutionForChallenge', () => {
  it('returns tailored copy for every challenge option', () => {
    const titles = new Set<string>();
    for (const opt of CHALLENGE_OPTIONS) {
      const sol = solutionForChallenge(opt.key);
      expect(sol.title.length).toBeGreaterThan(0);
      expect(sol.points.length).toBeGreaterThan(0);
      titles.add(sol.title);
    }
    // Every challenge gets DISTINCT copy — the whole point of the step.
    expect(titles.size).toBe(CHALLENGE_OPTIONS.length);
  });

  it('falls back to tracking copy when unanswered', () => {
    expect(solutionForChallenge(null).title).toBe(solutionForChallenge('tracking').title);
  });
});

describe('profile-not-loaded resilience (auth/me delayed or failing)', () => {
  beforeEach(() => AsyncStorage.clear());

  it('readOnboardingState returns a usable default when nothing is saved', async () => {
    // The screen falls back to this same default when userId is null, so the
    // flow renders (welcome step) instead of a blank dead-end.
    const s = await readOnboardingState('user-without-saved-state');
    expect(s).toEqual(DEFAULT_ONBOARDING_STATE);
    expect(s.step).toBe(0);
  });

  it('a completion recorded without a user id is adopted into the account state', async () => {
    // Finish happened while /auth/me was still failing → device-scoped flag.
    await markPendingDoneWithoutUser();
    await adoptPendingDone('u1');
    const local = await readOnboardingState('u1');
    expect(local.localDone).toBe(true);
    // …so once the profile finally resolves with the server flag still false,
    // the funnel does NOT re-run.
    expect(needsOnboarding({ is_demo: false, onboarding_completed: false }, local)).toBe(false);
  });

  it('adopting is a no-op without a pending flag and preserves saved progress with one', async () => {
    await writeOnboardingState('u2', { ...DEFAULT_ONBOARDING_STATE, step: 3, weeklyGoal: 750 });
    await adoptPendingDone('u2');
    expect((await readOnboardingState('u2')).localDone).toBe(false);

    await markPendingDoneWithoutUser();
    await adoptPendingDone('u2');
    const s = await readOnboardingState('u2');
    expect(s.localDone).toBe(true);
    expect(s.weeklyGoal).toBe(750);
    // Flag is consumed — a different account isn't affected.
    await adoptPendingDone('u3');
    expect((await readOnboardingState('u3')).localDone).toBe(false);
  });
});

describe('DEFAULT_ONBOARDING_STATE', () => {
  it('starts at the welcome step with a sane default goal', () => {
    expect(DEFAULT_ONBOARDING_STATE.step).toBe(0);
    expect(GOAL_STOPS).toContain(DEFAULT_ONBOARDING_STATE.weeklyGoal as any);
    expect(DEFAULT_ONBOARDING_STATE.localDone).toBe(false);
  });
});
