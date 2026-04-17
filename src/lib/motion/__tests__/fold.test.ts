/**
 * Fold verb tests — exit invariants mirror Bloom, different easing/duration.
 */

import { describe, it, expect } from 'vitest';
import { fold, foldStatic, FOLD_CSS_CLASS } from '../fold';
import { bloom } from '../bloom';
import { easings } from '../easings';

describe('fold', () => {
  it('exit scale matches bloom.exit.scale (symmetry)', () => {
    expect(fold.exit.scale).toBe(bloom.exit.scale);
  });

  it('exit translates down by 8px like bloom.exit', () => {
    expect(fold.exit.y).toBe(8);
  });

  it('uses foldIn easing (fast-start ease-in)', () => {
    expect(fold.transition.ease).toBe(easings.foldIn);
  });

  it('is quicker than bloom (240ms vs 320ms)', () => {
    expect(fold.transition.duration).toBe(0.24);
    expect(fold.transition.duration).toBeLessThan(bloom.transition.duration);
  });
});

describe('foldStatic', () => {
  it('zero-duration fallback', () => {
    expect(foldStatic.transition.duration).toBe(0);
  });

  it('exit keeps geometry stable — only opacity changes', () => {
    expect(foldStatic.exit).toEqual({ scale: 1, opacity: 0, y: 0 });
  });
});

describe('FOLD_CSS_CLASS', () => {
  it('exports stable class name', () => {
    expect(FOLD_CSS_CLASS).toBe('zen-fold');
  });
});
