/**
 * Breathe verb tests — infinite loop params + static fallback.
 */

import { describe, it, expect } from 'vitest';
import { breathe, breatheStatic, BREATHE_CSS_CLASS } from '../breathe';
import { easings } from '../easings';

describe('breathe', () => {
  it('scale keyframes go 1 → 1.015 → 1 (subtle)', () => {
    expect(breathe.animate.scale).toEqual([1, 1.015, 1]);
  });

  it('opacity keyframes go 0.88 → 1 → 0.88', () => {
    expect(breathe.animate.opacity).toEqual([0.88, 1, 0.88]);
  });

  it('loops infinitely', () => {
    expect(breathe.transition.repeat).toBe(Infinity);
  });

  it('cycle is 4 seconds', () => {
    expect(breathe.transition.duration).toBe(4);
  });

  it('uses symmetric ease-in-out', () => {
    expect(breathe.transition.ease).toBe(easings.breathe);
  });
});

describe('breatheStatic', () => {
  it('renders static scale=1 and opacity=1', () => {
    expect(breatheStatic.animate).toEqual({ scale: 1, opacity: 1 });
  });

  it('has zero duration — no loop runs', () => {
    expect(breatheStatic.transition.duration).toBe(0);
  });
});

describe('BREATHE_CSS_CLASS', () => {
  it('stable name', () => {
    expect(BREATHE_CSS_CLASS).toBe('zen-breathe');
  });
});
