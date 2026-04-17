/**
 * Settle verb tests — spring physics params.
 */

import { describe, it, expect } from 'vitest';
import { settle, settleStatic } from '../settle';

describe('settle', () => {
  it('is a spring transition', () => {
    expect(settle.type).toBe('spring');
  });

  it('stiffness is 200 (per plan spec)', () => {
    expect(settle.stiffness).toBe(200);
  });

  it('damping is 24 (crisper than springs.dragDrop)', () => {
    expect(settle.damping).toBe(24);
  });

  it('mass is 1 (unit)', () => {
    expect(settle.mass).toBe(1);
  });

  it('damping > stiffness ratio lands in critical-ish range for layout', () => {
    const ratio = settle.damping / Math.sqrt(settle.stiffness * settle.mass);
    // Underdamped but close to critical — perceived ~300ms settle without overshoot.
    expect(ratio).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(2.0);
  });
});

describe('settleStatic', () => {
  it('zero-duration fallback for reduced-motion', () => {
    expect(settleStatic.duration).toBe(0);
  });
});
