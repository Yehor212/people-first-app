/**
 * Easings contract tests — verb curves (stable) + M3-aligned named tokens.
 *
 * Named token values follow the Material Design 3 motion easing/duration
 * system (m3.material.io/styles/motion): entering elements decelerate,
 * exiting elements accelerate — asymmetric easing encodes direction.
 * See ANIMATION_SOFT_MOTION_PLAN.md (P1).
 */

import { describe, it, expect } from 'vitest';
import { easings, toCssBezier } from '../easings';

describe('easings — verb curves stay stable', () => {
  it.each([
    ['bloomOut', [0.2, 0.9, 0.2, 1]],
    ['foldIn', [0.4, 0, 1, 1]],
    ['morphExpo', [0.19, 1, 0.22, 1]],
    ['breathe', [0.4, 0, 0.6, 1]],
    ['ripple', [0, 0, 1, 1]],
  ] as const)('%s keeps its 4-tuple', (name, tuple) => {
    expect(easings[name]).toEqual(tuple);
  });
});

describe('easings — M3-aligned named tokens', () => {
  it('standard — on-screen transitions', () => {
    expect(easings.standard).toEqual([0.2, 0, 0, 1]);
  });

  it('standardDecelerate — elements entering the screen', () => {
    expect(easings.standardDecelerate).toEqual([0, 0, 0, 1]);
  });

  it('standardAccelerate — elements leaving the screen', () => {
    expect(easings.standardAccelerate).toEqual([0.3, 0, 1, 1]);
  });

  it('emphasizedDecelerate — hero/emphasized entrances (soft landing)', () => {
    expect(easings.emphasizedDecelerate).toEqual([0.05, 0.7, 0.1, 1]);
  });

  it('emphasizedAccelerate — emphasized exits', () => {
    expect(easings.emphasizedAccelerate).toEqual([0.3, 0, 0.8, 0.15]);
  });

  it('named tokens serialise to CSS cubic-bezier strings', () => {
    expect(toCssBezier(easings.emphasizedDecelerate)).toBe('cubic-bezier(0.05, 0.7, 0.1, 1)');
    expect(toCssBezier(easings.standard)).toBe('cubic-bezier(0.2, 0, 0, 1)');
  });
});
