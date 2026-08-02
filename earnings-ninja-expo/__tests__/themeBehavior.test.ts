// theme.ts imports AsyncStorage (native module) at module scope — mock it so
// the pure helpers can be imported in the jest-expo (node) environment.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { normalizePreference, resolveTheme } from '../lib/theme';
import type { ThemeName, ThemePreference } from '../lib/theme';

// Locks in the theme system's behavior so future changes can't silently break
// System mode or the walkthrough's temporary theme demo:
//  1. normalizePreference maps legacy stored values ('darkNeon'/'bwNeon' → dark),
//     preserves 'system', and defaults everything unknown to 'light'.
//  2. The rendered theme is: override ?? (pref === 'system' ? deviceScheme : pref).
//  3. Clearing the override (walkthrough demo end / early exit) always returns
//     to the SAVED preference — never sticks on the demo theme.

// Mirror of ThemeProvider's resolution line:
//   const resolved: ThemeName = override ?? resolveTheme(preference, systemScheme);
const resolved = (
  override: ThemeName | null,
  pref: ThemePreference,
  system: ThemeName,
): ThemeName => override ?? resolveTheme(pref, system);

describe('normalizePreference (legacy stored values)', () => {
  it('preserves the canonical values', () => {
    expect(normalizePreference('dark')).toBe('dark');
    expect(normalizePreference('light')).toBe('light');
    expect(normalizePreference('system')).toBe('system');
  });

  it('maps legacy dark looks to dark', () => {
    expect(normalizePreference('darkNeon')).toBe('dark');
    expect(normalizePreference('bwNeon')).toBe('dark');
  });

  it('maps legacy light / unknown / missing to light (the default)', () => {
    expect(normalizePreference('simpleLight')).toBe('light');
    expect(normalizePreference('someFutureTheme')).toBe('light');
    expect(normalizePreference('')).toBe('light');
    expect(normalizePreference(null)).toBe('light');
    expect(normalizePreference(undefined)).toBe('light');
  });
});

describe('resolveTheme (system preference follows device appearance)', () => {
  it('explicit preferences ignore the device scheme', () => {
    expect(resolveTheme('dark', 'light')).toBe('dark');
    expect(resolveTheme('dark', 'dark')).toBe('dark');
    expect(resolveTheme('light', 'dark')).toBe('light');
    expect(resolveTheme('light', 'light')).toBe('light');
  });

  it("'system' resolves to whatever the device reports", () => {
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', 'light')).toBe('light');
  });
});

describe('override precedence (walkthrough theme demo)', () => {
  it('an active override beats every saved preference', () => {
    expect(resolved('dark', 'light', 'light')).toBe('dark');
    expect(resolved('light', 'dark', 'dark')).toBe('light');
    expect(resolved('dark', 'system', 'light')).toBe('dark');
    expect(resolved('light', 'system', 'dark')).toBe('light');
  });

  it('clearing the override returns to the saved preference', () => {
    // Demo flips a light user to dark, then reverts.
    expect(resolved(null, 'light', 'dark')).toBe('light');
    // Demo flips a dark user to light, then reverts.
    expect(resolved(null, 'dark', 'light')).toBe('dark');
    // System users return to the CURRENT device scheme, not a frozen one.
    expect(resolved(null, 'system', 'dark')).toBe('dark');
    expect(resolved(null, 'system', 'light')).toBe('light');
  });

  it('device scheme changes flow through while system pref is saved and no override is active', () => {
    let system: ThemeName = 'light';
    expect(resolved(null, 'system', system)).toBe('light');
    system = 'dark'; // OS appearance flips
    expect(resolved(null, 'system', system)).toBe('dark');
  });
});
