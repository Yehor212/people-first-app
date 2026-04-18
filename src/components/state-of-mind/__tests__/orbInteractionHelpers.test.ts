/**
 * Phase 3-B.2 Task D unit tests.
 * Covers: reactive breath mapping, long-press cancellation contract,
 * metaball-merge envelope timing, and deterministic blob2 spawn.
 */

import { describe, it, expect } from 'vitest';
import {
  breathRateForValence,
  breathAmpForValence,
  shouldCancelLongPress,
  computeMergeEnvelope,
  pickBlob2SpawnUV,
  LONG_PRESS_MS,
  LONG_PRESS_SLOP_PX,
  MERGE_TOTAL_MS,
  MERGE_SPAWN_MS,
  MERGE_CONVERGE_MS,
  MERGE_PULSE_MS,
} from '../orbInteractionHelpers';

describe('breathRateForValence', () => {
  it('maps |v|=0 to 0.25 Hz (4s cycle)', () => {
    expect(breathRateForValence(0)).toBeCloseTo(0.25, 5);
  });
  it('maps |v|=0.5 to 0.375 Hz (linear lerp)', () => {
    expect(breathRateForValence(0.5)).toBeCloseTo(0.375, 5);
    expect(breathRateForValence(-0.5)).toBeCloseTo(0.375, 5);
  });
  it('maps |v|=1 to 0.5 Hz (2s cycle)', () => {
    expect(breathRateForValence(1)).toBeCloseTo(0.5, 5);
    expect(breathRateForValence(-1)).toBeCloseTo(0.5, 5);
  });
  it('clamps supra-extreme valences (|v|>1)', () => {
    expect(breathRateForValence(2)).toBeCloseTo(0.5, 5);
    expect(breathRateForValence(-3)).toBeCloseTo(0.5, 5);
  });
});

describe('breathAmpForValence', () => {
  it('maps |v|=0 to 0.02 (low amplitude, calm)', () => {
    expect(breathAmpForValence(0)).toBeCloseTo(0.02, 5);
  });
  it('maps |v|=1 to 0.06 (high amplitude, intense)', () => {
    expect(breathAmpForValence(1)).toBeCloseTo(0.06, 5);
    expect(breathAmpForValence(-1)).toBeCloseTo(0.06, 5);
  });
  it('maps |v|=0.5 to 0.04 (midpoint)', () => {
    expect(breathAmpForValence(0.5)).toBeCloseTo(0.04, 5);
  });
});

describe('shouldCancelLongPress', () => {
  it('cancels when displacement exceeds 8px slop', () => {
    expect(shouldCancelLongPress({ dxPx: 10, dyPx: 0, elapsedMs: 400, pointerLifted: false })).toBe(true);
    expect(shouldCancelLongPress({ dxPx: 6, dyPx: 6, elapsedMs: 400, pointerLifted: false })).toBe(true); // hypot > 8
  });
  it('does not cancel on sub-slop jitter', () => {
    expect(shouldCancelLongPress({ dxPx: 3, dyPx: 3, elapsedMs: 400, pointerLifted: false })).toBe(false);
    expect(shouldCancelLongPress({ dxPx: LONG_PRESS_SLOP_PX, dyPx: 0, elapsedMs: 400, pointerLifted: false })).toBe(false);
  });
  it('cancels when pointer lifted at 599ms (just below threshold)', () => {
    expect(shouldCancelLongPress({ dxPx: 0, dyPx: 0, elapsedMs: LONG_PRESS_MS - 1, pointerLifted: true })).toBe(true);
  });
  it('does not cancel when pointer lifted at 601ms (past threshold)', () => {
    expect(shouldCancelLongPress({ dxPx: 0, dyPx: 0, elapsedMs: LONG_PRESS_MS + 1, pointerLifted: true })).toBe(false);
  });
});

describe('computeMergeEnvelope', () => {
  it('returns zero envelope at rest (t<=0 and t>=total)', () => {
    const pre = computeMergeEnvelope(-100);
    expect(pre.progress).toBe(0);
    expect(pre.blob2Scale).toBe(0);
    expect(pre.pulse).toBe(0);

    const post = computeMergeEnvelope(MERGE_TOTAL_MS + 50);
    expect(post.progress).toBe(0);
    expect(post.blob2Scale).toBe(0);
  });

  it('ramps progress from 0→1 during 0..200ms spawn', () => {
    const mid = computeMergeEnvelope(100); // mid-spawn
    expect(mid.progress).toBeGreaterThan(0.3);
    expect(mid.progress).toBeLessThan(0.8);
    expect(mid.blob2Scale).toBeGreaterThan(0);
    expect(mid.converge).toBe(0); // converge hasn't started
  });

  it('holds progress at 1 during converge+pulse (200..1000ms)', () => {
    const conv = computeMergeEnvelope(500);
    expect(conv.progress).toBeCloseTo(1, 5);
    expect(conv.blob2Scale).toBeCloseTo(0.6, 5);
    expect(conv.converge).toBeGreaterThan(0);
  });

  it('peaks pulse at midpoint of pulse window (900ms)', () => {
    const pulsePeak = computeMergeEnvelope(MERGE_SPAWN_MS + MERGE_CONVERGE_MS + MERGE_PULSE_MS / 2);
    expect(pulsePeak.pulse).toBeCloseTo(1, 4);
  });

  it('ramps down progress during collapse (1000..1200ms)', () => {
    const collapse = computeMergeEnvelope(MERGE_TOTAL_MS - 50);
    expect(collapse.progress).toBeGreaterThan(0);
    expect(collapse.progress).toBeLessThan(1);
    expect(collapse.blob2Scale).toBeGreaterThan(0);
    expect(collapse.blob2Scale).toBeLessThan(0.6);
  });

  it('total sequence is 1200ms', () => {
    expect(MERGE_TOTAL_MS).toBe(1200);
  });
});

describe('pickBlob2SpawnUV', () => {
  it('returns UV inside aura radius (0.125..0.20 from center)', () => {
    for (let i = 0; i < 50; i++) {
      const uv = pickBlob2SpawnUV();
      const dx = uv.x - 0.5;
      const dy = uv.y - 0.5;
      const r = Math.hypot(dx, dy);
      expect(r).toBeGreaterThanOrEqual(0.125 - 1e-9);
      expect(r).toBeLessThanOrEqual(0.20 + 1e-9);
    }
  });

  it('is deterministic under a seeded rng', () => {
    const seedRng = (seq: number[]) => {
      let i = 0;
      return () => seq[i++ % seq.length];
    };
    const a = pickBlob2SpawnUV(seedRng([0.25, 0.0]));
    const b = pickBlob2SpawnUV(seedRng([0.25, 0.0]));
    expect(a).toEqual(b);
  });
});
