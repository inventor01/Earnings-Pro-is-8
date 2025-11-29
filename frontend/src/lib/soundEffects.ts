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
 * Play a squishy sound effect using Web Audio API
 */
export function playSquishySound(): void {
  if (isSoundMuted()) return;
  
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;
    
    // Create oscillator for squishy sound
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    // Squishy sound - quick downward frequency sweep
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
    
    // Quick fade out
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    
    osc.start(now);
    osc.stop(now + 0.08);
  } catch (error) {
    console.debug('Squishy sound not available:', error);
  }
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
