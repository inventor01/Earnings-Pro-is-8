// Regression for the "At least one platform/category must stay visible"
// false positive: validation must be computed from the RESULTING state
// (what remains AFTER the hide), never from the on-screen pill count — the
// pill row deliberately keeps showing an already-hidden option while it is
// the current selection, so screen count can exceed the true visible count.

import { canHideBuiltin } from '../lib/platforms';

const PLATFORMS = ['DOORDASH', 'UBEREATS', 'INSTACART', 'GRUBHUB', 'SHIPT', 'OTHER'];
const CATS = ['GAS', 'PARKING', 'TOLLS', 'MAINTENANCE', 'PHONE', 'SUPPLIES', 'FOOD', 'FUN', 'CHARITY', 'OTHER'];

describe('canHideBuiltin — resulting-state minimum-visible rule', () => {
  it('allows hiding down to exactly one visible (2 → 1)', () => {
    const hidden = PLATFORMS.filter(k => k !== 'UBEREATS' && k !== 'DOORDASH');
    const r = canHideBuiltin(PLATFORMS, hidden, 'DOORDASH', 0);
    expect(r).toEqual({ allowed: true, remainingVisibleCount: 1 });
  });

  it('allows hiding Uber Eats itself when another platform remains (2 → 1)', () => {
    const hidden = PLATFORMS.filter(k => k !== 'UBEREATS' && k !== 'DOORDASH');
    const r = canHideBuiltin(PLATFORMS, hidden, 'UBEREATS', 0);
    expect(r).toEqual({ allowed: true, remainingVisibleCount: 1 });
  });

  it('blocks hiding the last visible option (1 → 0)', () => {
    const hidden = PLATFORMS.filter(k => k !== 'UBEREATS');
    const r = canHideBuiltin(PLATFORMS, hidden, 'UBEREATS', 0);
    expect(r).toEqual({ allowed: false, remainingVisibleCount: 0 });
  });

  it('a custom item counts as a remaining option (1 builtin + 1 custom)', () => {
    const hidden = PLATFORMS.filter(k => k !== 'UBEREATS');
    const r = canHideBuiltin(PLATFORMS, hidden, 'UBEREATS', 1);
    expect(r).toEqual({ allowed: true, remainingVisibleCount: 1 });
  });

  it('hiding an ALREADY-hidden key is a no-op and never blocks (retained-pill case)', () => {
    // Screen shows 2 pills (one retained-but-hidden); true visible = 1.
    // Re-hiding the retained pill leaves 1 visible → allowed.
    const hidden = PLATFORMS.filter(k => k !== 'DOORDASH'); // UBEREATS already hidden
    const r = canHideBuiltin(PLATFORMS, hidden, 'UBEREATS', 0);
    expect(r).toEqual({ allowed: true, remainingVisibleCount: 1 });
  });

  it('never depends on WHICH platform is involved', () => {
    for (const victim of PLATFORMS) {
      const hidden = PLATFORMS.filter(k => k !== victim && k !== 'OTHER');
      if (victim === 'OTHER') continue;
      expect(canHideBuiltin(PLATFORMS, hidden, victim, 0).allowed).toBe(true);
      expect(canHideBuiltin(PLATFORMS, hidden, victim, 0).remainingVisibleCount).toBe(1);
    }
  });

  it('works identically for expense categories (10 → 9 … 1 → 0)', () => {
    expect(canHideBuiltin(CATS, [], 'GAS', 0)).toEqual({ allowed: true, remainingVisibleCount: 9 });
    const allButOne = CATS.filter(k => k !== 'FOOD');
    expect(canHideBuiltin(CATS, allButOne, 'FOOD', 0)).toEqual({ allowed: false, remainingVisibleCount: 0 });
    expect(canHideBuiltin(CATS, allButOne, 'FOOD', 2)).toEqual({ allowed: true, remainingVisibleCount: 2 });
  });

  it('duplicate keys in the hidden list cannot skew the count', () => {
    const hidden = ['UBEREATS', 'UBEREATS', 'INSTACART', 'INSTACART', 'GRUBHUB', 'SHIPT'];
    // Visible: DOORDASH + OTHER. Hiding DOORDASH leaves OTHER.
    expect(canHideBuiltin(PLATFORMS, hidden, 'DOORDASH', 0)).toEqual({ allowed: true, remainingVisibleCount: 1 });
  });
});
