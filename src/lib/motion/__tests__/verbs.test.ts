/**
 * Verbs barrel tests — export surface + gated() helper + shared easings.
 */

import { describe, it, expect, vi } from 'vitest';
import { verbs, gated, easings, toCssBezier } from '../verbs';

vi.mock('@/lib/animationUtils', () => ({
  shouldAnimate: vi.fn(),
}));
import { shouldAnimate } from '@/lib/animationUtils';

describe('verbs barrel', () => {
  it('exports all six verbs plus static fallbacks', () => {
    expect(verbs.bloom).toBeDefined();
    expect(verbs.bloomStatic).toBeDefined();
    expect(verbs.fold).toBeDefined();
    expect(verbs.foldStatic).toBeDefined();
    expect(verbs.morph).toBeTypeOf('function');
    expect(verbs.morphTiming).toBeDefined();
    expect(verbs.settle).toBeDefined();
    expect(verbs.settleStatic).toBeDefined();
    expect(verbs.breathe).toBeDefined();
    expect(verbs.breatheStatic).toBeDefined();
    expect(verbs.ripple).toBeTypeOf('function');
    expect(verbs.rippleDurationMs).toBe(200);
    expect(verbs.withTransitionName).toBeTypeOf('function');
  });

  it('has exactly 13 surface keys — 6 verbs, 4 static fallbacks, 3 helpers', () => {
    const keys = Object.keys(verbs);
    expect(keys).toHaveLength(13);
  });
});

describe('easings', () => {
  it('bloomOut decelerates (4-tuple cubic-bezier)', () => {
    expect(easings.bloomOut).toEqual([0.2, 0.9, 0.2, 1]);
  });

  it('morphExpo uses the expo ease-out tuple', () => {
    expect(easings.morphExpo).toEqual([0.19, 1, 0.22, 1]);
  });

  it('ripple is linear', () => {
    expect(easings.ripple).toEqual([0, 0, 1, 1]);
  });

  it('breathe is symmetric ease-in-out', () => {
    expect(easings.breathe).toEqual([0.4, 0, 0.6, 1]);
  });

  it('foldIn uses fast-start ease-in', () => {
    expect(easings.foldIn).toEqual([0.4, 0, 1, 1]);
  });
});

describe('toCssBezier', () => {
  it('serialises a 4-tuple to cubic-bezier(...)', () => {
    expect(toCssBezier(easings.bloomOut)).toBe('cubic-bezier(0.2, 0.9, 0.2, 1)');
  });
});

describe('gated()', () => {
  it('returns the verb when shouldAnimate is true', () => {
    vi.mocked(shouldAnimate).mockReturnValue(true);
    expect(gated(verbs.bloom, verbs.bloomStatic)).toBe(verbs.bloom);
  });

  it('returns the fallback when shouldAnimate is false', () => {
    vi.mocked(shouldAnimate).mockReturnValue(false);
    expect(gated(verbs.bloom, verbs.bloomStatic)).toBe(verbs.bloomStatic);
  });

  it('supports heterogeneous types for verb and fallback', () => {
    vi.mocked(shouldAnimate).mockReturnValue(false);
    const result = gated({ scale: 1.05 }, null);
    expect(result).toBeNull();
  });
});
