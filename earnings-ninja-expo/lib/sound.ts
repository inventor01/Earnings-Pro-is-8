import type { AudioPlayer } from 'expo-audio';
import { AppState } from 'react-native';
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
//
// Lifecycle hygiene (fixes "sound keeps playing / duplicates after reopening"):
// - ONE native player instance, tracked on globalThis so a JS context reload
//   (OTA update apply, dev fast refresh) removes the stale native player
//   instead of leaking it and ending up with two players that both fire.
// - An AppState listener stops playback the moment the app leaves the
//   foreground, so a ka-ching started right before backgrounding can never
//   resume or finish when the app comes back.
// - A short re-trigger guard collapses double-fires for the SAME event (e.g.
//   save path + notification listener racing) while still letting genuinely
//   rapid back-to-back saves each play.

export const SOUND_ENABLED_KEY = 'sound_enabled';

// Stash the player on globalThis: module-local state is lost on a JS reload,
// but the native object it pointed at is NOT — this key lets the fresh JS
// context find and release the previous instance before creating a new one.
const GLOBAL_PLAYER_KEY = '__earningsNinjaKachingPlayer__';

let player: AudioPlayer | null = null;
let audioModeSet = false;
let appStateWired = false;
// Timestamp of the last accepted play; double-triggers inside this window are
// the same logical event (a human can't save two entries in 300ms).
let lastPlayMs = 0;
const RETRIGGER_GUARD_MS = 300;

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

/** Stop any in-flight ka-ching and rewind. Safe to call anytime. */
export function stopKaching(): void {
  try {
    player?.pause();
    // seekTo is async — detach and swallow any rejection so a dying native
    // handle can't surface an unhandled promise rejection.
    void player?.seekTo(0)?.catch?.(() => {});
  } catch {
    // no-op — releasing/stopping must never throw into callers
  }
}

/** Release the native player entirely (used on JS reload + available for
 * teardown). The next playKaching() lazily recreates it. */
export function releaseKaching(): void {
  try {
    player?.pause();
    player?.remove();
  } catch {
    // no-op
  }
  player = null;
  (globalThis as Record<string, unknown>)[GLOBAL_PLAYER_KEY] = undefined;
}

function ensurePlayer(): AudioPlayer | null {
  if (player) return player;
  // Lazy native require: see top-of-file note. Throws on a binary without the
  // native module, which the catch in playKaching turns into a silent no-op.
  const { createAudioPlayer, setAudioModeAsync } =
    require('expo-audio') as typeof import('expo-audio');

  // A previous JS context (OTA apply / fast refresh) may have left a live
  // native player behind. Release it BEFORE creating a new one, or both
  // instances stay resident and can both produce audio.
  const stale = (globalThis as Record<string, unknown>)[GLOBAL_PLAYER_KEY] as
    | AudioPlayer
    | undefined;
  if (stale) {
    try {
      stale.pause();
      stale.remove();
    } catch {
      // stale handle may already be dead — fine
    }
    (globalThis as Record<string, unknown>)[GLOBAL_PLAYER_KEY] = undefined;
  }

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
  (globalThis as Record<string, unknown>)[GLOBAL_PLAYER_KEY] = player;

  // Stop playback whenever the app leaves the foreground (backgrounded,
  // app-switcher, device lock). Wired once per JS context, only after a player
  // actually exists, so the module stays inert on builds without expo-audio.
  if (!appStateWired) {
    appStateWired = true;
    AppState.addEventListener('change', (state) => {
      if (state !== 'active') stopKaching();
    });
  }
  return player;
}

// Play the ka-ching, honoring the Settings toggle. Entirely best-effort: any
// failure (asset missing in an OTA-only build, native module absent, audio
// session busy, etc.) is swallowed so it can never disrupt the save flow.
export async function playKaching(): Promise<void> {
  try {
    if (!(await getSoundEnabled())) return;
    // Collapse duplicate triggers for the same logical event.
    const now = Date.now();
    if (now - lastPlayMs < RETRIGGER_GUARD_MS) return;
    lastPlayMs = now;
    // Only play while foregrounded — a queued/racing trigger that lands after
    // backgrounding must not start audio under the lock screen.
    if (AppState.currentState !== 'active') return;
    const p = ensurePlayer();
    if (!p) return;
    // Rewind so rapid back-to-back saves each retrigger from the start.
    // seekTo is async — await it so play() can't race the rewind and overlap.
    await p.seekTo(0);
    p.play();
  } catch {
    // no-op
  }
}
