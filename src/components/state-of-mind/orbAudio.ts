/**
 * Generative ambient sound for ValenceOrb (P5).
 *
 * Creates a subtle drone that shifts with valence and breathes with the orb.
 * Pure Web Audio API synthesis — zero audio files, <1KB gzipped.
 *
 * Audio graph:
 *   3 OscillatorNodes (base + harmonic + sub-harmonic)
 *   → individual GainNodes (mix control)
 *   → BiquadFilterNode (lowpass, valence-driven cutoff)
 *   → GainNode (master volume, fade in/out)
 *   → AudioContext.destination
 *
 * All parameter changes use setTargetAtTime() for click-free transitions.
 * Gated by shouldPlaySounds() — silent when user disables sounds.
 */

import { getAudioContext } from '@/lib/audioManager';
import { recordError } from '@/lib/crashReporting';

export interface OrbAudioController {
  /** Update audio parameters each frame. Smooth, click-free transitions. */
  update(valence: number, breathPhase: number): void;
  /** Fade in the drone over duration (seconds). */
  fadeIn(duration?: number): void;
  /** Fade out the drone over duration (seconds). */
  fadeOut(duration?: number): void;
  /** Disconnect all nodes. Call on unmount. */
  dispose(): void;
}

// Smooth time constant for setTargetAtTime (300ms — matches visual interpolation)
const TAU = 0.3;

/**
 * Create generative ambient audio tied to the orb's emotional state.
 * Returns null if AudioContext is unavailable.
 */
export function createOrbAudio(): OrbAudioController | null {
  const ctx = getAudioContext();
  if (!ctx) return null;

  try {
    // ── Oscillators ──

    // Base drone: sine wave, 110-165Hz (A2 → E3)
    const baseOsc = ctx.createOscillator();
    baseOsc.type = 'sine';
    baseOsc.frequency.value = 137; // start at neutral (C#3)

    // Harmonic: triangle wave, perfect 5th above base
    const harmonicOsc = ctx.createOscillator();
    harmonicOsc.type = 'triangle';
    harmonicOsc.frequency.value = 137 * 1.5;

    // Sub-harmonic: sine wave, octave below base
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = 137 * 0.5;

    // ── Gain nodes (individual mix) ──

    const baseGain = ctx.createGain();
    baseGain.gain.value = 0.08; // base is always audible

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = 0.0; // starts silent, grows with positive valence

    const subGain = ctx.createGain();
    subGain.gain.value = 0.0; // starts silent, grows with negative valence

    // Breath envelope: modulates base gain for breathing sync
    const breathGain = ctx.createGain();
    breathGain.gain.value = 1.0;

    // ── Filter (valence-driven brightness) ──

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600; // neutral cutoff
    filter.Q.value = 0.7; // gentle rolloff

    // ── Master gain (fade in/out) ──

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0; // start silent, fadeIn() to activate

    // ── Audio graph wiring ──

    baseOsc.connect(baseGain);
    harmonicOsc.connect(harmonicGain);
    subOsc.connect(subGain);

    baseGain.connect(breathGain);
    harmonicGain.connect(breathGain);
    subGain.connect(breathGain);

    breathGain.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Start all oscillators
    const now = ctx.currentTime;
    baseOsc.start(now);
    harmonicOsc.start(now);
    subOsc.start(now);

    let disposed = false;

    return {
      update(valence: number, breathPhase: number) {
        if (disposed) return;
        const t = ctx.currentTime;

        // Valence → frequency: 110Hz at v=-1, 137Hz at v=0, 165Hz at v=+1
        const baseFreq = 110 + (valence + 1) * 27.5;
        baseOsc.frequency.setTargetAtTime(baseFreq, t, TAU);
        harmonicOsc.frequency.setTargetAtTime(baseFreq * 1.5, t, TAU);
        subOsc.frequency.setTargetAtTime(baseFreq * 0.5, t, TAU);

        // Valence → mix: harmonic grows positive, sub grows negative
        const nv = (valence + 1) * 0.5; // 0 at v=-1, 1 at v=+1
        harmonicGain.gain.setTargetAtTime(nv * 0.04, t, TAU);
        subGain.gain.setTargetAtTime((1 - nv) * 0.04, t, TAU);

        // Valence → filter cutoff: 200Hz (muffled) → 1000Hz (bright)
        const cutoff = 200 + nv * 800;
        filter.frequency.setTargetAtTime(cutoff, t, TAU);

        // Breath sync: subtle volume modulation (±15%)
        const breathMod = 1.0 + Math.sin(breathPhase * Math.PI * 2) * 0.15;
        breathGain.gain.setTargetAtTime(breathMod, t, 0.1);
      },

      fadeIn(duration = 1.0) {
        if (disposed) return;
        const t = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(t);
        masterGain.gain.setValueAtTime(masterGain.gain.value, t);
        masterGain.gain.linearRampToValueAtTime(1.0, t + duration);
      },

      fadeOut(duration = 0.5) {
        if (disposed) return;
        const t = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(t);
        masterGain.gain.setValueAtTime(masterGain.gain.value, t);
        masterGain.gain.linearRampToValueAtTime(0.0, t + duration);
      },

      dispose() {
        if (disposed) return;
        disposed = true;

        const t = ctx.currentTime;

        // Stop oscillators gracefully (tiny fade to prevent click)
        try {
          masterGain.gain.cancelScheduledValues(t);
          masterGain.gain.setValueAtTime(masterGain.gain.value, t);
          masterGain.gain.linearRampToValueAtTime(0, t + 0.05);

          // Schedule stop after fade
          baseOsc.stop(t + 0.1);
          harmonicOsc.stop(t + 0.1);
          subOsc.stop(t + 0.1);
        } catch {
          // Already stopped — safe to ignore
        }

        // Disconnect (does NOT close shared AudioContext)
        try {
          masterGain.disconnect();
          filter.disconnect();
          breathGain.disconnect();
          baseGain.disconnect();
          harmonicGain.disconnect();
          subGain.disconnect();
        } catch {
          // Already disconnected
        }
      },
    };
  } catch (err) {
    recordError(err, { component: 'ValenceOrb', action: 'createOrbAudio' });
    return null;
  }
}
