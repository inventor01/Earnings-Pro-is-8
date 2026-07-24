// Pure content/calculation logic for the motivation notifications. Kept free
// of ALL native/Expo imports so it can be unit-tested and QA-simulated in
// plain Node. lib/notifications.ts owns scheduling; this module owns math+copy.

export const MASK_FALLBACK = '•••';

// Next clock occurrence of the given hour: today if it hasn't passed yet,
// otherwise tomorrow. `sameDay` tells the content authors whether the numbers
// we fetched NOW will still describe the same calendar day at delivery time —
// a notification armed today but delivered tomorrow must never bake in
// today's volatile figures (profit, week total), or it reads as flat wrong.
export function nextOccurrence(hour: number, now: Date = new Date()): { date: Date; sameDay: boolean } {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  const sameDay = d.getTime() > now.getTime();
  if (!sameDay) d.setDate(d.getDate() + 1);
  return { date: d, sameDay };
}

export const usd = (n: number) => `$${Math.round(n)}`;

export function morningBody(
  hidden: boolean,
  todayGoal: number,
  weekProfit: number,
  sameDay: boolean,
): string {
  if (hidden) return 'Time to hit the road 🔥 Every order counts.';
  // The week-profit brag is only safe when the notification fires later TODAY
  // (numbers fetched now still describe "this week so far" at delivery). For a
  // tomorrow-morning delivery it would be stale — and outright wrong across a
  // week boundary — so fall through to the goal, which is a persistent daily
  // target and stays accurate.
  if (sameDay && weekProfit > 0) {
    return `Strong week so far: ${usd(weekProfit)} 💪 Let's add to it today 🔥`;
  }
  if (todayGoal > 0) return `Today's goal: ${usd(todayGoal)} 🎯 Let's get it 🔥`;
  return 'Time to hit the road 🔥 Let\u2019s stack some orders.';
}

export function eveningBody(
  hidden: boolean,
  todayProfit: number,
  todayGoal: number,
  goalProgress: number | null,
  sameDay: boolean,
  mask: string = MASK_FALLBACK,
): string {
  if (hidden) return `Strong day on the road 🔥 Open the app to see your ${mask}.`;
  // Armed after tonight's slot → delivered TOMORROW evening. Today's profit
  // would be a different day's number by then, so use number-free copy. The
  // schedule is re-armed on every foreground and every save, so any app use
  // tomorrow replaces this with live figures.
  if (!sameDay) return 'Day\u2019s done 🌙 Open the app to see today\u2019s total 🥷';
  const base = `You're crushing it! +${usd(todayProfit)} today 🔥`;
  if (todayGoal > 0) {
    const remaining = todayGoal - todayProfit;
    // Completion = either signal says done: the server's goal_progress OR the
    // remaining amount computed from the same rollup. Keeping them OR'd means
    // rounding differences can never produce "Only $0 to your goal".
    if ((goalProgress ?? 0) >= 1 || remaining <= 0) return `${base} Goal smashed! 🎉`;
    // Only advertise a remaining amount when it rounds to a whole dollar —
    // "Only $0 to your goal" (remaining < $0.50) reads as a bug.
    if (Math.round(remaining) >= 1) return `${base} Only ${usd(remaining)} to your goal 💪`;
    return `${base} Goal smashed! 🎉`;
  }
  return base;
}
