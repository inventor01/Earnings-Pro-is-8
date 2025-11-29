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
    
    // Create oscillator for squishy sound - brighter, more playful
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    // Squishy sound - upward then downward frequency sweep for more character
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(500, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);
    
    // Quick envelope with punch
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    
    osc.start(now);
    osc.stop(now + 0.12);
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
