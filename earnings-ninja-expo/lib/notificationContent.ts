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

// Occurrence of `hour` exactly `dayOffset` days after the nextOccurrence base
// day. Used to queue a rolling week of nudges so a driver who doesn't open the
// app still hears from us every day (previously only the NEXT pair was queued,
// so notifications went silent after ~24h without an app open).
export function occurrenceAt(hour: number, dayOffset: number, now: Date = new Date()): Date {
  const base = nextOccurrence(hour, now).date;
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  return d;
}

export const usd = (n: number) => `$${Math.round(n)}`;

// ── Rotating copy for FUTURE days (armed today, delivered 1+ days out) ───────
// These never contain volatile numbers — only the persistent daily goal target
// or number-free encouragement — so they stay accurate no matter when they
// land. Variety is deterministic per delivery DATE (not per re-arm) so bursts
// of reschedules don't shuffle a given day's message.
const FUTURE_MORNING: string[] = [
  'Ready to crush today\u2019s earnings goal? 💪',
  'Every order gets you closer to your goal. Let\u2019s get started! 🚗',
  'Your future self will thank you for today\u2019s hustle 🎯',
  'Consistency builds success. Let\u2019s earn today 🔥',
  'New day, fresh miles. Let\u2019s stack some orders 🥷',
  'A few good hours today could make your whole week 💰',
  'Show up, log it, watch the numbers grow 📈',
];

const FUTURE_EVENING: string[] = [
  'Day\u2019s done 🌙 Open the app to see today\u2019s total 🥷',
  'How\u2019d today go? Your recap is waiting in the app 📊',
  'Wrap it up, Ninja 🌙 Check today\u2019s numbers before you rest.',
  'Another day logged is another day closer to your goals 💪',
  'Done driving? Take 10 seconds to review today\u2019s earnings 📈',
];

function pick(pool: string[], deliveryDate: Date): string {
  // Stable per calendar day: year*366+dayIndex keeps rotation across weeks.
  const idx = (deliveryDate.getFullYear() * 366 + deliveryDate.getMonth() * 31 + deliveryDate.getDate()) % pool.length;
  return pool[idx];
}

export function futureMorningBody(hidden: boolean, todayGoal: number, deliveryDate: Date): string {
  // The daily goal target is persistent, so it's safe to include (unless
  // Hidden Mode says no dollar figures on the lock screen, ever).
  if (!hidden && todayGoal > 0) {
    return `${pick(FUTURE_MORNING, deliveryDate)} Today\u2019s goal: ${usd(todayGoal)} 🎯`;
  }
  return pick(FUTURE_MORNING, deliveryDate);
}

export function futureEveningBody(deliveryDate: Date): string {
  // Always number-free: future-day profit is unknowable at arm time.
  return pick(FUTURE_EVENING, deliveryDate);
}

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
