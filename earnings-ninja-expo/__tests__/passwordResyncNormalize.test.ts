// Regression for the iOS secureTextEntry resync window: while the workaround
// temporarily writes `value + ' '` to the native field, any change event in
// that one-frame window must have the injected space stripped before it
// reaches state or the controlled value.

import { normalizeResyncText } from '../components/PasswordInput';

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
});
