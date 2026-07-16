// Rest-timer end cue: vibration + a short beep via WebAudio.
// The AudioContext must be created during a user gesture (iOS), so
// primeAudio() is called from set-completion taps.

let ctx: AudioContext | null = null;

export function primeAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function cueRestDone(): void {
  if (typeof navigator !== 'undefined') navigator.vibrate?.([200, 100, 200, 100, 400]);
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + 0.05;
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 2 ? 1175 : 880;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    }
  } catch {
    // no audio available — vibration already fired
  }
}
