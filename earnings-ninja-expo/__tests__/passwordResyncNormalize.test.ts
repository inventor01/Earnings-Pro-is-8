// Regression for the iOS secureTextEntry resync window: while the workaround
// temporarily writes `value + ' '` to the native field, any change event in
// that one-frame window must have the injected space stripped before it
// reaches state or the controlled value.

import { normalizeResyncText, computeRenderedValue } from '../components/PasswordInput';

describe('normalizeResyncText', () => {
  it('strips the injected space when a keystroke lands in the window', () => {
    expect(normalizeResyncText('abc', 'abc d')).toBe('abcd');
  });

  it('normalizes the bare temp string (programmatic write echo)', () => {
    expect(normalizeResyncText('abc', 'abc ')).toBe('abc');
  });

  it('passes text through when no resync is pending', () => {
    expect(normalizeResyncText(null, 'abc d')).toBe('abc d');
  });

  it('passes through unrelated edits (deletion, mid-string change)', () => {
    expect(normalizeResyncText('abc', 'ab')).toBe('ab');
    expect(normalizeResyncText('abc', 'axbc')).toBe('axbc');
  });

  it('preserves a deliberate space typed outside the window', () => {
    expect(normalizeResyncText(null, 'abc ')).toBe('abc ');
  });

  it('handles a space typed inside the window (base + space + space)', () => {
    expect(normalizeResyncText('abc', 'abc  ')).toBe('abc ');
  });

  it('handles empty base (nothing typed yet — window never opens, passthrough)', () => {
    expect(normalizeResyncText(null, 'x')).toBe('x');
  });

  it('type → show → hide → type sequence: appended char survives the window', () => {
    // After hide, window base is the full password; the next keystroke's
    // change event may carry the temp space — result must be password + char.
    const password = 'MyPassword123';
    expect(normalizeResyncText(password, `${password} !`)).toBe(`${password}!`);
  });

  it('triple-toggle: each window normalizes independently', () => {
    const p = 'secret';
    for (let i = 0; i < 3; i++) {
      expect(normalizeResyncText(p, `${p} `)).toBe(p);
      expect(normalizeResyncText(p, `${p} X`)).toBe(`${p}X`);
    }
  });

  it('paste replacing everything inside the window is passed through untouched', () => {
    expect(normalizeResyncText('abc', 'pasted-value')).toBe('pasted-value');
  });
});

// Rendered-value precedence for the Fabric-safe resync (see PasswordInput
// header, history item 3): the resync override wins, then the controlled
// prop, then the internal mirror — and it must ALWAYS be a string, so both
// resync phases are real committed native writes even in uncontrolled mode.
describe('computeRenderedValue', () => {
  it('resync override wins over controlled value (phase 1)', () => {
    expect(computeRenderedValue('secret ', 'secret', 'secret')).toBe('secret ');
  });

  it('restores the controlled value after the window closes (phase 2)', () => {
    expect(computeRenderedValue(null, 'secret', 'stale')).toBe('secret');
  });

  it('uncontrolled: renders the internal mirror, never undefined', () => {
    expect(computeRenderedValue(null, undefined, 'typed')).toBe('typed');
    expect(computeRenderedValue(null, undefined, '')).toBe('');
  });

  it('uncontrolled resync: phase 1 override then restore to internal mirror', () => {
    expect(computeRenderedValue('pw ', undefined, 'pw')).toBe('pw ');
    expect(computeRenderedValue(null, undefined, 'pw')).toBe('pw');
  });

  it('keystroke during window: once the window is cancelled, the fresh value renders', () => {
    // handleChangeText cancels the window (override -> null) and mirrors the
    // normalized text, so the very next render shows password + new char.
    expect(computeRenderedValue(null, 'MyPassword123!', 'MyPassword123!')).toBe('MyPassword123!');
  });
});
