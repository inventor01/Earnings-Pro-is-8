import type { Audio as AudioNS } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

// expo-av is a NATIVE module. It's imported lazily (require, inside try/catch)
// rather than at module top-level so that if this JS ever lands on a binary that
// predates the native module (e.g. an OTA pushed to an older build), it cannot
// crash the app on startup — the sound simply no-ops. The type-only import above
// is erased at compile time and never triggers a runtime load.

// ─── Ka-Ching sound effect ───────────────────────────────────────────────────
// Plays a short cash-register "ka-ching" when the user successfully logs an
// entry (including widget quick-adds, which route through the same save path)
// and when a motivation notification is delivered while the app is foregrounded.
//
// Opt-out only: defaults ON (an unset flag is treated as enabled) because the
// sound is the whole point of the feature; the Settings toggle persists the
// user's choice. expo-av is a NATIVE module, so this only works in a build that
// bundled it — it will no-op until the next EAS build.

export const SOUND_ENABLED_KEY = 'sound_enabled';

// A single cached Sound instance, lazily loaded on first play and then replayed
// from position 0. Keeping one loaded instance avoids the decode latency of
// re-creating it on every rapid entry save.
let sound: AudioNS.Sound | null = null;
let loading: Promise<void> | null = null;

export async function getSoundEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(SOUND_ENABLED_KEY);
    // Unset (null) → enabled by default; otherwise honor the stored flag.
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export async function setSoundEnabled(v: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SOUND_ENABLED_KEY, v ? '1' : '0');
  } catch {
    // Best-effort persistence; a failed write just means the toggle won't
    // survive a restart, which is non-fatal for a cosmetic feature.
  }
}

async function ensureLoaded(): Promise<void> {
  if (sound) return;
  if (!loading) {
    loading = (async () => {
      // Lazy native require: see top-of-file note. Throws on a binary without
      // the native module, which the catch below turns into a silent no-op.
      const { Audio } = require('expo-av') as typeof import('expo-av');
      // Play through the iOS silent switch — the sound only fires on a
      // deliberate user action (saving an entry) and is fully opt-outable, so
      // a driver on silent still gets the satisfying confirmation they enabled.
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: s } = await Audio.Sound.createAsync(
        require('../assets/kaching.wav'),
      );
      sound = s;
    })();
  }
  try {
    await loading;
  } catch {
    // Reset so a later play can retry the load instead of being stuck on a
    // rejected promise.
    loading = null;
    sound = null;
  }
}

// Play the ka-ching, honoring the Settings toggle. Entirely best-effort: any
// failure (asset missing in an OTA-only build, audio session busy, etc.) is
// swallowed so it can never disrupt the save flow.
export async function playKaching(): Promise<void> {
  try {
    if (!(await getSoundEnabled())) return;
    await ensureLoaded();
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // no-op
  }
}
