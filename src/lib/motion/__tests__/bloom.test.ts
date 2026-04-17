/**
 * Bloom verb tests — variant shape, easing, static fallback, CSS class.
 */

import { describe, it, expect } from 'vitest';
import { bloom, bloomStatic, BLOOM_CSS_CLASS } from '../bloom';
import { easings } from '../easings';

describe('bloom', () => {
  it('initial state is scaled-down, transparent, lifted', () => {
    expect(bloom.initial).toEqual({ scale: 0.92, opacity: 0, y: 8 });
  });

  it('animate state is the resting full-opacity position', () => {
    expect(bloom.animate).toEqual({ scale: 1, opacity: 1, y: 0 });
  });

  it('exit state recedes slightly less than initial (96% vs 92%)', () => {
    expect(bloom.exit.scale).toBe(0.96);
    expect(bloom.exit.opacity).toBe(0);
  });

  it('uses bloomOut easing and 320ms duration', () => {
    expect(bloom.transition.duration).toBe(0.32);
    expect(bloom.transition.ease).toBe(easings.bloomOut);
  });
});

describe('bloomStatic', () => {
  it('has zero duration for reduced-motion users', () => {
    expect(bloomStatic.transition.duration).toBe(0);
  });

  it('preserves visibility without transform offsets', () => {
    expect(bloomStatic.animate).toEqual({ scale: 1, opacity: 1, y: 0 });
    expect(bloomStatic.initial).toEqual({ scale: 1, opacity: 1, y: 0 });
  });
});

describe('BLOOM_CSS_CLASS', () => {
  it('is stable for CSS targeting', () => {
    expect(BLOOM_CSS_CLASS).toBe('zen-bloom');
  });
});
