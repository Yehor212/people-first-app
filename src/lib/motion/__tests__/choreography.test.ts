/**
 * Choreography tests.
 *
 * Covers:
 *   - Stage ladder values are stable (contract with verbs.css + callers).
 *   - staggerDelay returns seconds-scaled delay when animation is allowed.
 *   - staggerDelay returns identity when animation is suppressed.
 *   - childrenStagger shape + reduced-motion fallback.
 *   - isStage type-guard rejects unknowns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/animationUtils', () => ({
  shouldAnimate: vi.fn(() => true),
}));

import { shouldAnimate } from '@/lib/animationUtils';
import {
  stages,
  staggerDelay,
  childrenStagger,
  isStage,
  stageSeconds,
} from '../choreography';

const shouldAnimateMock = vi.mocked(shouldAnimate);

describe('choreography', () => {
  beforeEach(() => {
    shouldAnimateMock.mockReturnValue(true);
  });

  describe('stages ladder', () => {
    it('has stable millisecond values matching the Phase 2 plan', () => {
      expect(stages).toEqual({
        background: 0,
        chrome: 80,
        primary: 140,
        secondary: 220,
        cta: 360,
      });
    });

    it('is strictly monotonically increasing', () => {
      const values = Object.values(stages);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });
  });

  describe('isStage', () => {
    it('accepts all defined stages', () => {
      expect(isStage('background')).toBe(true);
      expect(isStage('chrome')).toBe(true);
      expect(isStage('primary')).toBe(true);
      expect(isStage('secondary')).toBe(true);
      expect(isStage('cta')).toBe(true);
    });

    it('rejects unknown names', () => {
      expect(isStage('footer')).toBe(false);
      expect(isStage('')).toBe(false);
      expect(isStage('PRIMARY')).toBe(false);
    });
  });

  describe('stageSeconds', () => {
    it('converts ms to seconds', () => {
      expect(stageSeconds('background')).toBe(0);
      expect(stageSeconds('primary')).toBeCloseTo(0.14, 5);
      expect(stageSeconds('cta')).toBeCloseTo(0.36, 5);
    });
  });

  describe('staggerDelay', () => {
    it('returns seconds-scaled delay when animation allowed', () => {
      expect(staggerDelay('background')).toEqual({ delay: 0 });
      expect(staggerDelay('chrome')).toEqual({ delay: 0.08 });
      expect(staggerDelay('primary')).toEqual({ delay: 0.14 });
      expect(staggerDelay('secondary')).toEqual({ delay: 0.22 });
      expect(staggerDelay('cta')).toEqual({ delay: 0.36 });
    });

    it('returns identity { duration: 0 } when animation suppressed', () => {
      shouldAnimateMock.mockReturnValue(false);
      expect(staggerDelay('primary')).toEqual({ duration: 0 });
      expect(staggerDelay('cta')).toEqual({ duration: 0 });
    });
  });

  describe('childrenStagger', () => {
    it('produces a stagger config with default secondary anchor', () => {
      const config = childrenStagger(5);
      expect(config).toEqual({
        delay: 0.22,
        staggerChildren: 0.04,
        delayChildren: 0.02,
      });
    });

    it('honours custom base stage', () => {
      const config = childrenStagger(3, 'primary');
      expect(config).toMatchObject({ delay: 0.14 });
    });

    it('returns identity when animation suppressed', () => {
      shouldAnimateMock.mockReturnValue(false);
      expect(childrenStagger(10, 'cta')).toEqual({ duration: 0 });
    });

    it('count parameter does not alter shape (API-symmetry)', () => {
      const a = childrenStagger(1);
      const b = childrenStagger(100);
      expect(a).toEqual(b);
    });
  });
});
