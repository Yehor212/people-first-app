/**
 * Pure helpers for Phase 3-B.2 Task D:
 *   • Reactive breath (rate + amplitude from |valence|)
 *   • Long-press detection (600 ms, 8 px slop)
 *   • Metaball-merge envelope (spawn → converge → pulse → collapse)
 *
 * These are extracted from ValenceOrb to keep the component under the
 * 400-LOC god-component threshold (Law 11) and to allow deterministic
 * unit testing without needing to mount the WebGL canvas.
 */

/** Breath rate in Hz: |v|=0 → 0.25 Hz (4 s cycle), |v|=1 → 0.5 Hz (2 s cycle). */
export function breathRateForValence(valence: number): number {
  const t = Math.min(1, Math.abs(valence));
  return 0.25 + (0.5 - 0.25) * t;
}

/** Breath amplitude (peak deviation from 1.0): |v|=0 → 0.02, |v|=1 → 0.06. */
export function breathAmpForValence(valence: number): number {
  const t = Math.min(1, Math.abs(valence));
  return 0.02 + (0.06 - 0.02) * t;
}

/** Long-press tunables (exported so the test suite can share them). */
export const LONG_PRESS_MS = 600;
export const LONG_PRESS_SLOP_PX = 8;

/** Metaball-merge timing constants (total sequence = 1200 ms). */
export const MERGE_SPAWN_MS = 200;    // 2nd blob scale 0 → 0.6
export const MERGE_CONVERGE_MS = 600; // position toward center
export const MERGE_PULSE_MS = 200;    // main-orb pulse 1.0 → 1.08 → 1.0
export const MERGE_COLLAPSE_MS = 200; // 2nd blob vanishes
export const MERGE_TOTAL_MS =
  MERGE_SPAWN_MS + MERGE_CONVERGE_MS + MERGE_PULSE_MS + MERGE_COLLAPSE_MS;

export interface MergeEnvelope {
  /** Overall 0..1 progress used for smin blend weight (ramps up, holds, then back down). */
  progress: number;
  /** 2nd blob scale 0..1 (peaks at 0.6 around spawn end, fades during collapse). */
  blob2Scale: number;
  /** 0..1 lerp used to interpolate the 2nd-blob position from spawn → center. */
  converge: number;
  /** 0..1 brief scale pulse on the main orb — peaks at phase midpoint. */
  pulse: number;
}

/** Smoothstep (Hermite 3t²-2t³) — classical shader easing. */
function smoothstep01(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

/**
 * Piecewise envelope for the 600 ms-trigger metaball merge sequence.
 * `t` is milliseconds since the 600 ms long-press fired.
 *
 * Phases:
 *   0..200        spawn       blob2 scale 0 → 0.6,    progress  → 1
 *   200..800      converge    blob2 moves → center,    pulse starts at 700
 *   800..1000     pulse peak  main orb 1.0 → 1.08 → 1.0
 *   1000..1200    collapse    blob2 fades + progress → 0
 */
export function computeMergeEnvelope(t: number): MergeEnvelope {
  if (t <= 0 || t >= MERGE_TOTAL_MS) {
    return { progress: 0, blob2Scale: 0, converge: 0, pulse: 0 };
  }

  // Progress: ramp up during spawn, hold through converge+pulse, ramp down on collapse.
  let progress = 0;
  if (t < MERGE_SPAWN_MS) {
    progress = smoothstep01(t / MERGE_SPAWN_MS);
  } else if (t < MERGE_SPAWN_MS + MERGE_CONVERGE_MS + MERGE_PULSE_MS) {
    progress = 1;
  } else {
    const collapseT = t - (MERGE_SPAWN_MS + MERGE_CONVERGE_MS + MERGE_PULSE_MS);
    progress = 1 - smoothstep01(collapseT / MERGE_COLLAPSE_MS);
  }

  // Scale: grow to 0.6 during spawn, hold, collapse to 0.
  let blob2Scale = 0;
  if (t < MERGE_SPAWN_MS) {
    blob2Scale = 0.6 * smoothstep01(t / MERGE_SPAWN_MS);
  } else if (t < MERGE_SPAWN_MS + MERGE_CONVERGE_MS + MERGE_PULSE_MS) {
    blob2Scale = 0.6;
  } else {
    const collapseT = t - (MERGE_SPAWN_MS + MERGE_CONVERGE_MS + MERGE_PULSE_MS);
    blob2Scale = 0.6 * (1 - smoothstep01(collapseT / MERGE_COLLAPSE_MS));
  }

  // Converge: starts at 0 on spawn end, reaches 1 at converge end.
  let converge = 0;
  if (t < MERGE_SPAWN_MS) {
    converge = 0;
  } else if (t < MERGE_SPAWN_MS + MERGE_CONVERGE_MS) {
    converge = smoothstep01((t - MERGE_SPAWN_MS) / MERGE_CONVERGE_MS);
  } else {
    converge = 1;
  }

  // Pulse: a 0→1→0 triangle across the 200 ms pulse window (800..1000).
  let pulse = 0;
  const pulseStart = MERGE_SPAWN_MS + MERGE_CONVERGE_MS;
  const pulseEnd = pulseStart + MERGE_PULSE_MS;
  if (t >= pulseStart && t < pulseEnd) {
    const u = (t - pulseStart) / MERGE_PULSE_MS;
    pulse = u < 0.5 ? smoothstep01(u / 0.5) : smoothstep01((1 - u) / 0.5);
  }

  return { progress, blob2Scale, converge, pulse };
}

/**
 * Pick a random offset inside the aura ring (0.5..0.8 × orb radius) and
 * return it as a UV point in [0,1]² for the 2nd-blob spawn position.
 * Deterministic when `rng` is provided — used by unit tests.
 */
export function pickBlob2SpawnUV(rng: () => number = Math.random): { x: number; y: number } {
  const theta = rng() * Math.PI * 2;
  // Radius in UV units: baseR (0.25) × 0.5..0.8 → 0.125..0.20.
  const r = 0.125 + rng() * 0.075;
  return {
    x: 0.5 + Math.cos(theta) * r,
    y: 0.5 + Math.sin(theta) * r,
  };
}

export interface LongPressState {
  readonly phase: 'rest' | 'pressing' | 'merging' | 'collapsing';
}

/**
 * Decide whether a pointer event should CANCEL a pending long-press.
 * Contract (keeps both branches testable without DOM):
 *   • dx/dy >8 px  → cancel (user is scrolling, not pressing)
 *   • lifted before 600 ms → cancel (tap, not long press)
 *   • otherwise continue waiting for the timer
 */
export function shouldCancelLongPress(opts: {
  dxPx: number;
  dyPx: number;
  elapsedMs: number;
  pointerLifted: boolean;
}): boolean {
  if (Math.hypot(opts.dxPx, opts.dyPx) > LONG_PRESS_SLOP_PX) return true;
  if (opts.pointerLifted && opts.elapsedMs < LONG_PRESS_MS) return true;
  return false;
}
