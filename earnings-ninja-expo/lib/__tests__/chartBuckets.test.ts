import {
  easternParts, easternHourOfDay, easternDayKey, easternWeekday,
  isHourlyPeriod, buildHourlyBuckets, buildDailyBuckets, dailySpan,
} from '../chartBuckets';

// 2026-07-15T03:30:00Z = 2026-07-14 23:30 EDT (UTC-4) — crosses the day boundary.
const LATE_NIGHT = '2026-07-15T03:30:00';
// 2026-01-15T03:30:00Z = 2026-01-14 22:30 EST (UTC-5).
const WINTER = '2026-01-15T03:30:00';

describe('eastern extraction', () => {
  it('maps a UTC instant to the previous Eastern day near midnight (EDT)', () => {
    const d = new Date(LATE_NIGHT + 'Z');
    expect(easternDayKey(d)).toBe('2026-07-14');
    expect(easternHourOfDay(d)).toBe(23);
  });

  it('handles EST (winter, UTC-5)', () => {
    const d = new Date(WINTER + 'Z');
    expect(easternDayKey(d)).toBe('2026-01-14');
    expect(easternHourOfDay(d)).toBe(22);
  });

  it('midnight Eastern reports hour 0, not 24', () => {
    // 04:00Z in July = 00:00 EDT
    const d = new Date('2026-07-15T04:00:00Z');
    expect(easternHourOfDay(d)).toBe(0);
    expect(easternDayKey(d)).toBe('2026-07-15');
  });

  it('weekday follows the Eastern calendar day', () => {
    // 2026-07-14 is a Tuesday (2); device-agnostic.
    expect(easternWeekday(new Date(LATE_NIGHT + 'Z'))).toBe(2);
  });

  it('easternParts returns 1-based month', () => {
    const p = easternParts(new Date('2026-07-15T12:00:00Z'));
    expect(p).toEqual({ y: 2026, m: 7, d: 15, h: 8 });
  });
});

describe('isHourlyPeriod', () => {
  it('single-day periods are hourly', () => {
    expect(isHourlyPeriod('today')).toBe(true);
    expect(isHourlyPeriod('yesterday')).toBe(true);
    expect(isHourlyPeriod('custom', { from: '2026-07-01', to: '2026-07-01' })).toBe(true);
  });
  it('multi-day periods are not', () => {
    expect(isHourlyPeriod('week')).toBe(false);
    expect(isHourlyPeriod('custom', { from: '2026-07-01', to: '2026-07-02' })).toBe(false);
  });
});

describe('buildHourlyBuckets', () => {
  it('sums signed amounts into the Eastern hour', () => {
    const buckets = buildHourlyBuckets([
      { timestamp: LATE_NIGHT, amount: 10 },      // 23 EDT (naive server ts -> UTC)
      { timestamp: LATE_NIGHT, amount: -3 },
      { timestamp: '2026-07-15T04:10:00', amount: 5 }, // 0 EDT
    ]);
    expect(buckets).toHaveLength(24);
    expect(buckets[23].sum).toBe(7);
    expect(buckets[0].sum).toBe(5);
    expect(buckets[0].label).toBe('12am');
    expect(buckets[13].label).toBe('1pm');
  });
});

describe('buildDailyBuckets (custom range)', () => {
  it('buckets by Eastern day across a custom range', () => {
    const buckets = buildDailyBuckets(
      [
        { timestamp: LATE_NIGHT, amount: 20 },          // eastern 07-14
        { timestamp: '2026-07-15T12:00:00', amount: 4 }, // eastern 07-15
        { timestamp: '2026-07-20T12:00:00', amount: 99 }, // outside range
      ],
      'custom',
      { from: '2026-07-13', to: '2026-07-16' },
    );
    expect(buckets.map(b => b.key)).toEqual(['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16']);
    expect(buckets[1].sum).toBe(20);
    expect(buckets[2].sum).toBe(4);
    expect(buckets[0].sum).toBe(0);
    expect(buckets[3].sum).toBe(0);
    expect(buckets[1].label).toBe('7/14');
  });

  it('caps at 31 buckets', () => {
    const buckets = buildDailyBuckets([], 'custom', { from: '2026-01-01', to: '2026-03-31' });
    expect(buckets).toHaveLength(31);
  });
});

describe('dailySpan', () => {
  it('lastMonth ends on the last day of the previous Eastern month', () => {
    const { endUTC } = dailySpan('lastMonth');
    const next = new Date(endUTC);
    next.setUTCDate(next.getUTCDate() + 1);
    expect(next.getUTCDate()).toBe(1); // end date is a month's last day
  });
  it('week spans 7 days', () => {
    expect(dailySpan('week').days).toBe(7);
  });
});
