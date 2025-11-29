/**
 * Play a cha-ching sound effect using Web Audio API
 */
export function playChaChing(): void {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create nodes
    const now = audioContext.currentTime;
    
    // First "cha" sound - higher pitch
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc1.start(now);
    osc1.stop(now + 0.1);
    
    // Second "ching" sound - even higher pitch
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    
    osc2.frequency.setValueAtTime(783.99, now + 0.05); // G5
    osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.25); // C6
    gain2.gain.setValueAtTime(0.3, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    
    osc2.start(now + 0.05);
    osc2.stop(now + 0.25);
  } catch (error) {
    // Silently fail if Web Audio API not available
    console.debug('Sound effect not available:', error);
  }
}
