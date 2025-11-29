import chaChinSound from '../assets/cha-ching.wav';

/**
 * Play a cha-ching sound effect
 */
export function playChaChing(): void {
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
