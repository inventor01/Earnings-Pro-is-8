import {
  nextOccurrence, occurrenceAt, morningBody, eveningBody,
  futureMorningBody, futureEveningBody, usd,
} from '../lib/notificationContent';

const at = (h: number, m = 0) => {
  const d = new Date(2026, 7, 2); // Aug 2 2026, local
  d.setHours(h, m, 0, 0);
  return d;
};

describe('nextOccurrence', () => {
  it('targets today when the hour has not passed', () => {
    const { date, sameDay } = nextOccurrence(9, at(8));
    expect(sameDay).toBe(true);
    expect(date.getDate()).toBe(2);
    expect(date.getHours()).toBe(9);
  });
  it('rolls to tomorrow when the hour has passed', () => {
    const { date, sameDay } = nextOccurrence(9, at(10));
    expect(sameDay).toBe(false);
    expect(date.getDate()).toBe(3);
  });
});

describe('occurrenceAt', () => {
  it('offsets whole days from the next occurrence', () => {
    const base = nextOccurrence(9, at(8)).date;
    const d3 = occurrenceAt(9, 3, at(8));
    expect(d3.getTime() - base.getTime()).toBe(3 * 24 * 3600 * 1000);
    expect(d3.getHours()).toBe(9);
  });
});

describe('day-boundary safety', () => {
  it('morning body never brags week profit for a tomorrow delivery', () => {
    expect(morningBody(false, 50, 900, false)).not.toContain('900');
    expect(morningBody(false, 50, 900, false)).toContain(usd(50));
  });
  it('evening body is number-free for a tomorrow delivery', () => {
    expect(eveningBody(false, 123, 200, 0.6, false)).not.toContain('123');
  });
  it('future evening copy never contains a dollar figure', () => {
    for (let d = 0; d < 14; d++) {
      expect(futureEveningBody(occurrenceAt(20, d, at(8)))).not.toContain('$');
    }
  });
  it('hidden mode strips the goal from future mornings', () => {
    const date = occurrenceAt(9, 2, at(8));
    expect(futureMorningBody(true, 75, date)).not.toContain('$');
    expect(futureMorningBody(false, 75, date)).toContain(usd(75));
  });
});

describe('rotation', () => {
  it('is deterministic per delivery date and varies across days', () => {
    const d1 = occurrenceAt(9, 1, at(8));
    expect(futureMorningBody(false, 0, d1)).toBe(futureMorningBody(false, 0, d1));
    const bodies = new Set(
      Array.from({ length: 7 }, (_, i) => futureMorningBody(false, 0, occurrenceAt(9, i, at(8)))),
    );
    expect(bodies.size).toBeGreaterThan(1);
  });
});
