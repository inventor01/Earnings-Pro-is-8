import { compactMoney } from '../compactMoney';

describe('compactMoney (calendar per-day amounts)', () => {
  it('shows cents only under $10, trimming trailing zeros', () => {
    expect(compactMoney(0)).toBe('$0');
    expect(compactMoney(0.5)).toBe('$0.5');
    expect(compactMoney(4.5)).toBe('$4.5');
    expect(compactMoney(4)).toBe('$4');
    expect(compactMoney(9.99)).toBe('$9.99');
  });

  it('rounds to whole dollars from $10 to $999', () => {
    expect(compactMoney(10.4)).toBe('$10');
    expect(compactMoney(87.25)).toBe('$87');
    expect(compactMoney(450.4)).toBe('$450');
    expect(compactMoney(999.4)).toBe('$999');
  });

  it('compacts thousands with one decimal', () => {
    expect(compactMoney(1000)).toBe('$1k');
    expect(compactMoney(1234)).toBe('$1.2k');
    expect(compactMoney(12500)).toBe('$12.5k');
    expect(compactMoney(99999)).toBe('$100k');
    expect(compactMoney(150000)).toBe('$150k');
  });

  it('keeps the sign on losses/expenses', () => {
    expect(compactMoney(-4.5)).toBe('-$4.5');
    expect(compactMoney(-450)).toBe('-$450');
    expect(compactMoney(-1234)).toBe('-$1.2k');
  });
});
