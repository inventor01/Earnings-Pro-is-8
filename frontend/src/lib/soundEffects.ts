import chaChinSound from '../assets/cha-ching.wav';

/**
 * Check if sounds are muted
 */
export function isSoundMuted(): boolean {
  const muted = localStorage.getItem('soundMuted');
  return muted === 'true';
}

/**
 * Set sound mute state
 */
export function setSoundMuted(muted: boolean): void {
  localStorage.setItem('soundMuted', muted ? 'true' : 'false');
}

/**
 * Play a cha-ching sound effect
 */
export function playChaChing(): void {
  if (isSoundMuted()) return;
  
  try {
    const audio = new Audio(chaChinSound);
    audio.volume = 0.5; // Set volume to 50%
    audio.play().catch((error) => {
      console.debug('Could not play sound effect:', error);
    });
  } catch (error) {
    // Silently fail if audio not available
    console.debug('Sound effect not available:', error);
  }
}
