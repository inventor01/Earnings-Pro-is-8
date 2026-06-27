import { QueryClient } from '@tanstack/react-query';
import {
  keyWindowContainsDate,
  applyOptimisticCreateRollup,
} from '../lib/rollupWindow';
import type { Rollup } from '../lib/api';

// Guards the "new entry shows on the dashboard INSTANTLY (no app restart)" fix.
// The regression was that the optimistic rollup/KPI patch for a CREATE was gated
// to today-only, so a backdated entry — or one added while viewing a navigated
// day / week / month — updated the History list but NOT the KPI cards / Profit
// Hero / Goal bar until a cold restart refetched the truth. The fix scopes the
// patch to EVERY cached ['rollup'] window whose range contains the entry's EST
// date (the same scoping the entries list and the edit flow already used).
//
// BASE is a FIXED EST "today" of Wed 2026-06-17 so every window boundary is
// deterministic regardless of when the suite runs:
//   - This week (Mon-start): 06-15, 06-16, 06-17
//   - Last 7 days:           06-11 .. 06-17
//   - This month:            06-01 .. 06-17
//   - Last month:            05-01 .. 05-31
const BASE = new Date(Date.UTC(2026, 5, 17)); // Wed Jun 17 2026

function makeRollup(over: Partial<Rollup> = {}): Rollup {
  return {
    revenue: 0,
    expenses: 0,
    profit: 0,
    miles: 0,
    hours: 0,
    dollars_per_mile: 0,
    average_order_value: 0,
    goal: null,
    goal_progress: null,
    ...over,
  };
}

describe('keyWindowContainsDate', () => {
  it('TODAY (offset 0) contains only the base day', () => {
    expect(keyWindowContainsDate(['rollup', 'TODAY', 0], '2026-06-17', BASE)).toBe(true);
    expect(keyWindowContainsDate(['rollup', 'TODAY', 0], '2026-06-16', BASE)).toBe(false);
    expect(keyWindowContainsDate(['rollup', 'TODAY', 0], '2026-06-18', BASE)).toBe(false);
  });

  it('TODAY at a negative offset tracks that earlier day, not base', () => {
    // ['rollup','TODAY',-1] is the "yesterday" day-window → base-1 = 06-16.
    expect(keyWindowContainsDate(['rollup', 'TODAY', -1], '2026-06-16', BASE)).toBe(true);
    expect(keyWindowContainsDate(['rollup', 'TODAY', -1], '2026-06-17', BASE)).toBe(false);
  });

  it('YESTERDAY contains only base-1', () => {
    expect(keyWindowContainsDate(['rollup', 'YESTERDAY'], '2026-06-16', BASE)).toBe(true);
    expect(keyWindowContainsDate(['rollup', 'YESTERDAY'], '2026-06-17', BASE)).toBe(false);
  });

  it('THIS_WEEK spans Monday..base inclusive, excludes prev Sunday and the future', () => {
    expect(keyWindowContainsDate(['rollup', 'THIS_WEEK'], '2026-06-15', BASE)).toBe(true); // Mon
    expect(keyWindowContainsDate(['rollup', 'THIS_WEEK'], '2026-06-17', BASE)).toBe(true); // base
    expect(keyWindowContainsDate(['rollup', 'THIS_WEEK'], '2026-06-14', BASE)).toBe(false); // prev Sun
    expect(keyWindowContainsDate(['rollup', 'THIS_WEEK'], '2026-06-18', BASE)).toBe(false); // future
  });

  it('LAST_7_DAYS spans base-6..base inclusive', () => {
    expect(keyWindowContainsDate(['rollup', 'LAST_7_DAYS'], '2026-06-11', BASE)).toBe(true);
    expect(keyWindowContainsDate(['rollup', 'LAST_7_DAYS'], '2026-06-17', BASE)).toBe(true);
    expect(keyWindowContainsDate(['rollup', 'LAST_7_DAYS'], '2026-06-10', BASE)).toBe(false);
    expect(keyWindowContainsDate(['rollup', 'LAST_7_DAYS'], '2026-06-18', BASE)).toBe(false);
  });

  it('THIS_MONTH spans the 1st..base, excludes future days and other months', () => {
    expect(keyWindowContainsDate(['rollup', 'THIS_MONTH'], '2026-06-01', BASE)).toBe(true);
    expect(keyWindowContainsDate(['rollup', 'THIS_MONTH'], '2026-06-17', BASE)).toBe(true);
    expect(keyWindowContainsDate(['rollup', 'THIS_MONTH'], '2026-06-18', BASE)).toBe(false); // future
    expect(keyWindowContainsDate(['rollup', 'THIS_MONTH'], '2026-05-31', BASE)).toBe(false); // prev month
  });

  it('LAST_MONTH spans the whole previous calendar month', () => {
    expect(keyWindowContainsDate(['rollup', 'LAST_MONTH'], '2026-05-01', BASE)).toBe(true);
    expect(keyWindowContainsDate(['rollup', 'LAST_MONTH'], '2026-05-31', BASE)).toBe(true);
    expect(keyWindowContainsDate(['rollup', 'LAST_MONTH'], '2026-04-30', BASE)).toBe(false);
    expect(keyWindowContainsDate(['rollup', 'LAST_MONTH'], '2026-06-01', BASE)).toBe(false);
  });

  it('custom range is inclusive and base-independent', () => {
    const k = ['rollup', 'custom', '2026-06-01', '2026-06-30'];
    expect(keyWindowContainsDate(k, '2026-06-17', BASE)).toBe(true);
    expect(keyWindowContainsDate(k, '2026-06-01', BASE)).toBe(true);
    expect(keyWindowContainsDate(k, '2026-06-30', BASE)).toBe(true);
    expect(keyWindowContainsDate(k, '2026-07-01', BASE)).toBe(false);
  });

  it('navigated (swiped) range is inclusive and base-independent', () => {
    const k = ['rollup', 'THIS_WEEK', 'nav', '2026-06-08', '2026-06-14'];
    expect(keyWindowContainsDate(k, '2026-06-10', BASE)).toBe(true);
    expect(keyWindowContainsDate(k, '2026-06-17', BASE)).toBe(false);
  });

  it('unknown / malformed keys default to true (reconciled later)', () => {
    expect(keyWindowContainsDate(['rollup'], '2026-06-17', BASE)).toBe(true);
    expect(keyWindowContainsDate(['rollup', 'WAT'], '2026-06-17', BASE)).toBe(true);
  });
});

describe('applyOptimisticCreateRollup', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient();
  });
  afterEach(() => {
    qc.clear();
  });

  function seedWindows() {
    qc.setQueryData(['rollup', 'TODAY', 0], makeRollup({ revenue: 100, profit: 100 }));
    qc.setQueryData(['rollup', 'THIS_WEEK'], makeRollup({ revenue: 500, profit: 500 }));
    qc.setQueryData(['rollup', 'THIS_MONTH'], makeRollup({ revenue: 2000, profit: 2000 }));
    qc.setQueryData(['rollup', 'LAST_MONTH'], makeRollup({ revenue: 9000, profit: 9000 }));
    qc.setQueryData(['rollup', 'LAST_7_DAYS'], makeRollup({ revenue: 700, profit: 700 }));
  }

  it('a TODAY order patches every window that contains today and leaves others untouched', () => {
    seedWindows();
    applyOptimisticCreateRollup(
      qc,
      { type: 'ORDER', amount: 50, distance_miles: 10 },
      '2026-06-17',
      BASE,
    );

    expect(qc.getQueryData<Rollup>(['rollup', 'TODAY', 0])).toMatchObject({ revenue: 150, profit: 150, miles: 10 });
    expect(qc.getQueryData<Rollup>(['rollup', 'THIS_WEEK'])).toMatchObject({ revenue: 550, profit: 550, miles: 10 });
    expect(qc.getQueryData<Rollup>(['rollup', 'THIS_MONTH'])).toMatchObject({ revenue: 2050, profit: 2050 });
    expect(qc.getQueryData<Rollup>(['rollup', 'LAST_7_DAYS'])).toMatchObject({ revenue: 750, profit: 750 });
    // June 17 is NOT in last month → untouched.
    expect(qc.getQueryData<Rollup>(['rollup', 'LAST_MONTH'])).toMatchObject({ revenue: 9000, profit: 9000 });
    // dollars_per_mile recomputed from the patched profit/miles.
    expect(qc.getQueryData<Rollup>(['rollup', 'TODAY', 0])?.dollars_per_mile).toBeCloseTo(15);
  });

  it('REGRESSION: a backdated entry still ticks the windows that contain it (was today-only before)', () => {
    seedWindows();
    // 06-11 is inside LAST_7_DAYS (06-11..06-17) but NOT in THIS_WEEK (Mon 06-15+)
    // and NOT today (06-17). Before the fix the KPI patch was gated to today, so
    // none of these moved until a cold restart.
    applyOptimisticCreateRollup(
      qc,
      { type: 'ORDER', amount: 40 },
      '2026-06-11',
      BASE,
    );

    expect(qc.getQueryData<Rollup>(['rollup', 'LAST_7_DAYS'])).toMatchObject({ revenue: 740, profit: 740 });
    expect(qc.getQueryData<Rollup>(['rollup', 'THIS_MONTH'])).toMatchObject({ revenue: 2040, profit: 2040 });
    // 06-11 is not today and not in this (Mon-started) week → those stay put.
    expect(qc.getQueryData<Rollup>(['rollup', 'TODAY', 0])).toMatchObject({ revenue: 100, profit: 100 });
    expect(qc.getQueryData<Rollup>(['rollup', 'THIS_WEEK'])).toMatchObject({ revenue: 500, profit: 500 });
  });

  it('an EXPENSE raises expenses and lowers profit, never revenue', () => {
    seedWindows();
    applyOptimisticCreateRollup(
      qc,
      { type: 'EXPENSE', amount: 30 },
      '2026-06-17',
      BASE,
    );

    expect(qc.getQueryData<Rollup>(['rollup', 'TODAY', 0])).toMatchObject({
      revenue: 100,
      expenses: 30,
      profit: 70,
    });
  });

  it('recomputes goal_progress against the goal target when present', () => {
    qc.setQueryData(
      ['rollup', 'TODAY', 0],
      makeRollup({ revenue: 100, profit: 100, goal: { target_profit: 200, goal_name: 'Daily' }, goal_progress: 0.5 }),
    );
    applyOptimisticCreateRollup(qc, { type: 'ORDER', amount: 100 }, '2026-06-17', BASE);
    expect(qc.getQueryData<Rollup>(['rollup', 'TODAY', 0])?.goal_progress).toBeCloseTo(1); // 200/200
  });

  it('returns a snapshot that restores every window exactly on rollback', () => {
    seedWindows();
    const snapshot = applyOptimisticCreateRollup(qc, { type: 'ORDER', amount: 999 }, '2026-06-17', BASE);

    // Simulate the onError rollback the create mutation performs with ctx.prev.
    for (const [key, data] of snapshot) {
      qc.setQueryData(key, data);
    }

    expect(qc.getQueryData<Rollup>(['rollup', 'TODAY', 0])).toMatchObject({ revenue: 100, profit: 100 });
    expect(qc.getQueryData<Rollup>(['rollup', 'THIS_WEEK'])).toMatchObject({ revenue: 500, profit: 500 });
    expect(qc.getQueryData<Rollup>(['rollup', 'THIS_MONTH'])).toMatchObject({ revenue: 2000, profit: 2000 });
  });

  it('two successive creates accumulate (rapid add-add)', () => {
    qc.setQueryData(['rollup', 'TODAY', 0], makeRollup({ revenue: 0, profit: 0 }));
    applyOptimisticCreateRollup(qc, { type: 'ORDER', amount: 25 }, '2026-06-17', BASE);
    applyOptimisticCreateRollup(qc, { type: 'ORDER', amount: 75 }, '2026-06-17', BASE);
    expect(qc.getQueryData<Rollup>(['rollup', 'TODAY', 0])).toMatchObject({ revenue: 100, profit: 100 });
  });
});
