// theme.ts imports AsyncStorage (native module) at module scope — mock it so
// the pure helpers can be imported in the jest-expo (node) environment.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { Appearance } from 'react-native';
import { normalizePreference, resolveTheme } from '../lib/theme';
import type { ThemeName, ThemePreference } from '../lib/theme';

// Locks in the theme system's behavior so future changes can't silently break
// the Light/Dark-only model or the walkthrough's temporary theme demo:
//  1. normalizePreference maps legacy stored values ('darkNeon'/'bwNeon' → dark),
//     and migrates the RETIRED 'system' value (plus null/unknown) to the
//     device's CURRENT appearance.
//  2. The rendered theme is: override ?? preference (no system indirection).
//  3. Clearing the override (walkthrough demo end / early exit) always returns
//     to the SAVED preference — never sticks on the demo theme.

const mockScheme = (scheme: 'light' | 'dark' | null) =>
  jest.spyOn(Appearance, 'getColorScheme').mockReturnValue(scheme);

afterEach(() => jest.restoreAllMocks());

// Mirror of ThemeProvider's resolution line:
//   const resolved: ThemeName = override ?? resolveTheme(preference);
const resolved = (override: ThemeName | null, pref: ThemePreference): ThemeName =>
  override ?? resolveTheme(pref);

describe('normalizePreference', () => {
  it('preserves the canonical values', () => {
    expect(normalizePreference('dark')).toBe('dark');
    expect(normalizePreference('light')).toBe('light');
  });

  it('maps legacy dark looks to dark', () => {
    expect(normalizePreference('darkNeon')).toBe('dark');
    expect(normalizePreference('bwNeon')).toBe('dark');
  });

  it('maps legacy simpleLight to light', () => {
    expect(normalizePreference('simpleLight')).toBe('light');
  });

  it("migrates the retired 'system' value to the device's current appearance", () => {
    mockScheme('dark');
    expect(normalizePreference('system')).toBe('dark');
    mockScheme('light');
    expect(normalizePreference('system')).toBe('light');
  });

  it('defaults unknown / missing values to the device appearance', () => {
    mockScheme('dark');
    expect(normalizePreference(null)).toBe('dark');
    expect(normalizePreference(undefined)).toBe('dark');
    expect(normalizePreference('someFutureTheme')).toBe('dark');
    mockScheme('light');
    expect(normalizePreference(null)).toBe('light');
    expect(normalizePreference('')).toBe('light');
    // No reported scheme at all → light.
    mockScheme(null);
    expect(normalizePreference(null)).toBe('light');
  });
});

describe('resolveTheme (fixed Light/Dark choice)', () => {
  it('returns exactly the saved preference', () => {
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });
});

describe('override precedence (walkthrough theme demo)', () => {
  it('an active override beats the saved preference', () => {
    expect(resolved('dark', 'light')).toBe('dark');
    expect(resolved('light', 'dark')).toBe('light');
  });

  it('clearing the override returns to the saved preference', () => {
    expect(resolved(null, 'light')).toBe('light');
    expect(resolved(null, 'dark')).toBe('dark');
  });
});
