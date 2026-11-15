let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) {
      audioCtx = new Ctor();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTone(
  frequency: number,
  durationSec = 0.09,
  type: OscillatorType = 'triangle',
  volume = 0.08,
  muted = false
) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationSec);
  } catch {
    // Ignore audio context errors on restricted browsers
  }
}

export function playJumpSound(muted = false) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(210, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(460, ctx.currentTime + 0.11);
    gain.gain.setValueAtTime(0.055, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Ignore
  }
}

export function playCollectSound(muted = false) {
  playTone(587.33, 0.07, 'sine', 0.07, muted);
  setTimeout(() => playTone(880, 0.1, 'sine', 0.07, muted), 60);
}

export function playCorrectSound(muted = false) {
  playTone(523.25, 0.08, 'triangle', 0.08, muted);
  setTimeout(() => playTone(659.25, 0.09, 'triangle', 0.08, muted), 70);
  setTimeout(() => playTone(783.99, 0.14, 'triangle', 0.08, muted), 140);
}

export function playWrongSound(muted = false) {
  playTone(220, 0.14, 'sawtooth', 0.06, muted);
  setTimeout(() => playTone(165, 0.2, 'sawtooth', 0.06, muted), 110);
}

export function playCrashSound(muted = false) {
  playTone(130, 0.22, 'sawtooth', 0.09, muted);
  setTimeout(() => playTone(85, 0.28, 'square', 0.07, muted), 90);
}

export function playRevClimbSound(muted = false) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(290, ctx.currentTime + 0.16);
    osc.frequency.setValueAtTime(195, ctx.currentTime + 0.17);
    osc.frequency.exponentialRampToValueAtTime(360, ctx.currentTime + 0.32);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.34);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignore
  }
  playCorrectSound(muted);
}

export function playSkidCrashSound(muted = false) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    // Tire skid sweep
    const skid = ctx.createOscillator();
    const skidGain = ctx.createGain();
    skid.type = 'triangle';
    skid.frequency.setValueAtTime(640, ctx.currentTime);
    skid.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.24);
    skidGain.gain.setValueAtTime(0.06, ctx.currentTime);
    skidGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    skid.connect(skidGain);
    skidGain.connect(ctx.destination);
    skid.start();
    skid.stop(ctx.currentTime + 0.26);
  } catch {
    // Ignore
  }
  setTimeout(() => playCrashSound(muted), 110);
}

