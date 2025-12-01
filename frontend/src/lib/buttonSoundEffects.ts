import { isSoundMuted } from './soundEffects';

// Play button click sound
export const playButtonClickSound = () => {
  // Check if sound is muted before playing
  if (isSoundMuted()) return;
  
  try {
    // Create new audio element for each click to allow rapid successive plays
    const audio = new Audio('/sounds/button-click.wav');
    audio.volume = 0.6;
    audio.currentTime = 0;
    
    // Try to play with error handling
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Silently fail if blocked by browser autoplay policy
      });
    }
  } catch (error) {
    // Silently fail if audio API not available
  }
};
