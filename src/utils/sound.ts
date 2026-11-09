/**
 * Audio synthesis, haptics, and Screen Wake Lock for Android / Mobile
 */

let audioCtx: AudioContext | null = null;
let isSoundMuted = false;

// Initialize or resume AudioContext on user interaction
export function initAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch (err) {
    console.warn('AudioContext not available:', err);
    return null;
  }
}

export function setSoundMuted(muted: boolean) {
  isSoundMuted = muted;
}

export function getSoundMuted(): boolean {
  return isSoundMuted;
}

export function triggerHaptic(pattern: number | number[] = 30) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported
  }
}

export function playTap() {
  if (isSoundMuted) return;
  try {
    const ctx = initAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch {}
}

export function playCountdownTick() {
  if (isSoundMuted) return;
  triggerHaptic(40);
  try {
    const ctx = initAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch {}
}

export function playTimerDone() {
  if (isSoundMuted) return;
  triggerHaptic([100, 50, 150]);
  try {
    const ctx = initAudioContext();
    if (!ctx) return;
    
    // Two-tone bell
    const now = ctx.currentTime;
    
    // Note 1: E5 (659Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Note 2: A5 (880Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.35, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.5);
  } catch {}
}

export function playExerciseCompleted() {
  if (isSoundMuted) return;
  triggerHaptic(50);
  try {
    const ctx = initAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Upbeat chord C5 -> G5
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, now);
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.15);
    gain1.gain.setValueAtTime(0.22, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);
  } catch {}
}

export function playWorkoutDoneFanfare() {
  if (isSoundMuted) return;
  triggerHaptic([100, 60, 100, 60, 200]);
  try {
    const ctx = initAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.12;
      const duration = i === notes.length - 1 ? 0.6 : 0.2;
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  } catch {}
}

// Keep screen awake while workout is active
let wakeLockSentinel: unknown = null;

export async function requestWakeLock(): Promise<boolean> {
  try {
    if ('wakeLock' in navigator && (navigator as unknown as { wakeLock: { request: (type: string) => Promise<unknown> } }).wakeLock) {
      wakeLockSentinel = await (navigator as unknown as { wakeLock: { request: (type: string) => Promise<unknown> } }).wakeLock.request('screen');
      return true;
    }
  } catch (e) {
    console.log('WakeLock not granted or supported:', e);
  }
  return false;
}

export function releaseWakeLock() {
  try {
    if (wakeLockSentinel && typeof (wakeLockSentinel as { release: () => Promise<void> }).release === 'function') {
      (wakeLockSentinel as { release: () => Promise<void> }).release();
      wakeLockSentinel = null;
    }
  } catch {}
}
