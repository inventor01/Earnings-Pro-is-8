import kaChingSound from '../assets/ka-ching.wav';

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
 * Play a soft coin drop sound effect using Web Audio API
 */
export function playChaChing(): void {
  if (isSoundMuted()) return;
  
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;
    
    // Create oscillator for coin drop sound
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    // Coin drop - descending frequency sweep
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.3);
    
    // Quiet volume with gentle fade out
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.02, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (error) {
    console.debug('Sound effect not available:', error);
  }
}

/**
 * Play ka-ching sound effect from audio file
 */
export function playKaChing(): void {
  if (isSoundMuted()) return;
  
  try {
    const audio = new Audio(kaChingSound);
    audio.volume = 0.7;
    audio.play().catch((err) => {
      console.debug('Ka-ching sound not available:', err);
    });
  } catch (error) {
    console.debug('Ka-ching sound error:', error);
  }
}

/**
 * Play intro sound effect from audio file
 */
export function playIntroSound(): void {
  if (isSoundMuted()) return;
  
  try {
    const audio = new Audio('/sounds/intro-sound.wav');
    audio.volume = 0.7;
    audio.play().catch((err) => {
      console.debug('Intro sound not available:', err);
    });
  } catch (error) {
    console.debug('Intro sound error:', error);
  }
}
