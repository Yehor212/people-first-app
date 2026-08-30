import { describe, expect, it } from "vitest";

import { reprojectOrbParticles } from "../orbGeometry";
import type { Particle } from "../particleSystem";

function createParticle(): Particle {
  return {
    x: 120,
    y: 60,
    vx: 2,
    vy: -1,
    radius: 4,
    alpha: 0.75,
    life: 20,
    maxLife: 80,
    hueOffset: 12,
  };
}

describe("reprojectOrbParticles", () => {
  it("preserves the normalized particle field when the Orb size changes", () => {
    const particle = createParticle();

    expect(reprojectOrbParticles([particle], 240, 120)).toBe(true);
    expect(particle).toEqual({
      x: 60,
      y: 30,
      vx: 1,
      vy: -0.5,
      radius: 2,
      alpha: 0.75,
      life: 20,
      maxLife: 80,
      hueOffset: 12,
    });
  });

  it("round-trips hero to refine to hero without changing particle phase fields", () => {
    const particle = createParticle();

    expect(reprojectOrbParticles([particle], 240, 120)).toBe(true);
    expect(reprojectOrbParticles([particle], 120, 240)).toBe(true);

    expect(particle.x).toBeCloseTo(120, 12);
    expect(particle.y).toBeCloseTo(60, 12);
    expect(particle.vx).toBeCloseTo(2, 12);
    expect(particle.vy).toBeCloseTo(-1, 12);
    expect(particle.radius).toBeCloseTo(4, 12);
    expect(particle).toMatchObject({
      alpha: 0.75,
      life: 20,
      maxLife: 80,
      hueOffset: 12,
    });
  });

  it.each([
    [0, 120],
    [-1, 120],
    [Number.NaN, 120],
    [Number.POSITIVE_INFINITY, 120],
    [240, 0],
    [240, -1],
    [240, Number.NaN],
    [240, Number.NEGATIVE_INFINITY],
  ])("rejects invalid size pair %s -> %s without mutating particles", (previousSize, nextSize) => {
    const particle = createParticle();
    const before = { ...particle };

    expect(reprojectOrbParticles([particle], previousSize, nextSize)).toBe(false);
    expect(particle).toEqual(before);
  });

  it("leaves the particle object untouched when the size is unchanged", () => {
    const particle = createParticle();
    const before = { ...particle };

    expect(reprojectOrbParticles([particle], 240, 240)).toBe(true);
    expect(particle).toEqual(before);
  });
});
