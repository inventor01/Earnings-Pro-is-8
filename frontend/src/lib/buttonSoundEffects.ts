// Play button click sound
export const playButtonClickSound = () => {
  try {
    const audio = new Audio('/sounds/button-click.wav');
    audio.volume = 0.6;
    audio.play().catch(() => {
      // Silently fail if autoplay is blocked
    });
  } catch {
    // Silently fail if audio API not available
  }
};
