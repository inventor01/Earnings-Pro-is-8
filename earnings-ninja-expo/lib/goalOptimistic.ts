import type { QueryClient } from '@tanstack/react-query';
import type { Goal, TimeframeType } from './api';

// Pure, testable optimistic-cache helpers for the goal editors. Extracted from
// the Settings goal mutation so the "typed value shows instantly offline and
// sticks until sync" behavior can be unit-tested without mounting the screen.

export interface OptimisticGoalCtx {
  tf: TimeframeType;
  prevGoal: Goal | null | undefined;
}

// Optimistically write the typed goal target into the ['goal', tf] query so the
// Settings goal row reflects it instantly — including offline, where it must
// STICK (the queued upsert resolves as synthetic success, so onError never
// fires and this patch is what the user keeps seeing until the queue drains).
// Returns a context for rollback.
export async function applyOptimisticGoal(
  qc: QueryClient,
  tf: TimeframeType,
  target: number,
): Promise<OptimisticGoalCtx> {
  await qc.cancelQueries({ queryKey: ['goal', tf] });
  const prevGoal = qc.getQueryData<Goal | null>(['goal', tf]);
  qc.setQueryData(['goal', tf], (old: any) => ({
    id: old?.id ?? -1,
    timeframe: tf,
    goal_name: old?.goal_name ?? 'Goal',
    target_profit: target,
  }));
  return { tf, prevGoal };
}

// Restore the pre-edit goal value. Called only on a real (non-network) server
// error — offline edits resolve as synthetic success, so this never fires for
// them and the optimistic value persists.
export function rollbackOptimisticGoal(
  qc: QueryClient,
  ctx: OptimisticGoalCtx | undefined,
): void {
  if (!ctx) return;
  qc.setQueryData(['goal', ctx.tf], ctx.prevGoal);
}
