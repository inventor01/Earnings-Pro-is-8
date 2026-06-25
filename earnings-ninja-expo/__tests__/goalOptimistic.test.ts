import { QueryClient } from '@tanstack/react-query';
import {
  applyOptimisticGoal,
  rollbackOptimisticGoal,
  OptimisticGoalCtx,
} from '../lib/goalOptimistic';
import type { Goal } from '../lib/api';

// Guards Task #14's offline goal-edit optimistic behavior on the Settings rows:
// the typed value must show instantly via the optimistic cache patch, a real
// server error must roll back to the previous value, and an offline edit (which
// the api resolves as a synthetic success rather than throwing) must persist
// because onError — and therefore the rollback — never fires.

function makeGoal(tf: Goal['timeframe'], target: number): Goal {
  return { id: 7, timeframe: tf, goal_name: 'Goal', target_profit: target };
}

describe('goal optimistic cache helpers', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient();
  });

  afterEach(() => {
    qc.clear();
  });

  it('onMutate optimistically patches the typed value into ["goal", tf]', async () => {
    qc.setQueryData(['goal', 'THIS_WEEK'], makeGoal('THIS_WEEK', 100));

    const ctx = await applyOptimisticGoal(qc, 'THIS_WEEK', 250);

    const patched = qc.getQueryData<Goal>(['goal', 'THIS_WEEK']);
    expect(patched?.target_profit).toBe(250);
    // Identity fields are preserved from the prior goal.
    expect(patched?.id).toBe(7);
    expect(patched?.goal_name).toBe('Goal');
    expect(patched?.timeframe).toBe('THIS_WEEK');
    // Other timeframes are untouched.
    expect(qc.getQueryData(['goal', 'THIS_MONTH'])).toBeUndefined();
    // Context carries the pre-edit value for rollback.
    expect((ctx.prevGoal as Goal)?.target_profit).toBe(100);
    expect(ctx.tf).toBe('THIS_WEEK');
  });

  it('synthesizes a goal when none existed before (offline first-time set)', async () => {
    const ctx = await applyOptimisticGoal(qc, 'TODAY', 50);

    const patched = qc.getQueryData<Goal>(['goal', 'TODAY']);
    expect(patched?.target_profit).toBe(50);
    expect(patched?.id).toBe(-1);
    expect(patched?.goal_name).toBe('Goal');
    expect(ctx.prevGoal).toBeUndefined();
  });

  it('onError rolls back to the previous goal on a real server error', async () => {
    qc.setQueryData(['goal', 'THIS_MONTH'], makeGoal('THIS_MONTH', 1000));

    const ctx = await applyOptimisticGoal(qc, 'THIS_MONTH', 9999);
    expect(qc.getQueryData<Goal>(['goal', 'THIS_MONTH'])?.target_profit).toBe(9999);

    rollbackOptimisticGoal(qc, ctx);

    expect(qc.getQueryData<Goal>(['goal', 'THIS_MONTH'])?.target_profit).toBe(1000);
  });

  it('offline edit persists: with no onError firing, the optimistic value stays', async () => {
    qc.setQueryData(['goal', 'TODAY'], makeGoal('TODAY', 30));

    // api.upsertGoal resolves a synthetic success when offline, so the mutation
    // takes the onSuccess path — rollbackOptimisticGoal is never called.
    await applyOptimisticGoal(qc, 'TODAY', 75);

    // Value remains the typed target until the queued upsert drains.
    expect(qc.getQueryData<Goal>(['goal', 'TODAY'])?.target_profit).toBe(75);
  });

  it('rollback is a no-op when given no context', () => {
    qc.setQueryData(['goal', 'TODAY'], makeGoal('TODAY', 30));
    const undefinedCtx = undefined as unknown as OptimisticGoalCtx | undefined;
    rollbackOptimisticGoal(qc, undefinedCtx);
    expect(qc.getQueryData<Goal>(['goal', 'TODAY'])?.target_profit).toBe(30);
  });
});
