import type { AudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

// expo-audio is a NATIVE module (the SDK 54 successor to the now-removed
// expo-av). It is loaded LAZILY via require() inside a try/catch rather than at
// module top-level so that if this JS ever lands on a binary that predates the
// native module (e.g. an OTA pushed to an older build), it cannot crash the app
// on startup — the sound simply no-ops. The type-only import above is erased at
// compile time and never triggers a runtime load.

// ─── Ka-Ching sound effect ───────────────────────────────────────────────────
// Plays a short cash-register "ka-ching" when the user successfully logs an
// entry (including widget quick-adds, which route through the same save path)
// and when a motivation notification is delivered while the app is foregrounded.
//
// Opt-out only: defaults ON (an unset flag is treated as enabled) because the
// sound is the whole point of the feature; the Settings toggle persists the
// user's choice. expo-audio is a NATIVE module, so this only works in a build
// that bundled it — it will no-op until the next EAS build.

export const SOUND_ENABLED_KEY = 'sound_enabled';

// A single cached AudioPlayer, lazily created on first play and then replayed
// from position 0. Keeping one loaded instance avoids the decode latency of
// re-creating it on every rapid entry save.
let player: AudioPlayer | null = null;
let audioModeSet = false;

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

function ensurePlayer(): AudioPlayer | null {
  if (player) return player;
  // Lazy native require: see top-of-file note. Throws on a binary without the
  // native module, which the catch in playKaching turns into a silent no-op.
  const { createAudioPlayer, setAudioModeAsync } =
    require('expo-audio') as typeof import('expo-audio');
  if (!audioModeSet) {
    // Play through the iOS silent switch — the sound only fires on a deliberate
    // user action (saving an entry) and is fully opt-outable, so a driver on
    // silent still gets the satisfying confirmation they enabled. Best-effort;
    // a failure here must not block creating/playing the sound.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    audioModeSet = true;
  }
  // createAudioPlayer is synchronous and loads the bundled asset eagerly, so the
  // player is ready to play essentially immediately for a small local file.
  player = createAudioPlayer(require('../assets/kaching.wav'));
  return player;
}

// Play the ka-ching, honoring the Settings toggle. Entirely best-effort: any
// failure (asset missing in an OTA-only build, native module absent, audio
// session busy, etc.) is swallowed so it can never disrupt the save flow.
export async function playKaching(): Promise<void> {
  try {
    if (!(await getSoundEnabled())) return;
    const p = ensurePlayer();
    if (!p) return;
    // Rewind so rapid back-to-back saves each retrigger from the start.
    p.seekTo(0);
    p.play();
  } catch {
    // no-op
  }
}
