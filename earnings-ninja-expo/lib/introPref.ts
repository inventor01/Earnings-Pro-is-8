import AsyncStorage from '@react-native-async-storage/async-storage';

// Settings → "Show intro animation" preference. Device-scoped (AsyncStorage),
// defaults ON. Read once during cold-start hydration (before first render) so
// the IntroVideo overlay either mounts immediately or never mounts at all —
// there is no flash of the intro before the preference loads.

export const INTRO_ENABLED_KEY = 'intro_enabled';

export async function getIntroEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(INTRO_ENABLED_KEY);
    // Unset (null) → enabled by default; otherwise honor the stored flag.
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export async function setIntroEnabled(v: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(INTRO_ENABLED_KEY, v ? '1' : '0');
  } catch {
    // Best-effort persistence; a failed write just means the toggle won't
    // survive a restart, which is non-fatal for a cosmetic feature.
  }
}
