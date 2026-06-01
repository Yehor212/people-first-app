import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveParticleFrameScale,
  resolveParticleVelocityCap,
  updateParticles,
  type Particle,
} from "../particleSystem";

function makeParticle(overrides: Partial<Particle> = {}): Particle {
  return {
    x: 128,
    y: 128,
    vx: 0,
    vy: 0,
    radius: 3,
    alpha: 1,
    life: 10,
    maxLife: 120,
    hueOffset: 0,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("state-of-mind particle system", () => {
  it("keeps frame scaling bounded after browser stalls or tab wakeups", () => {
    expect(resolveParticleFrameScale(1 / 60)).toBeCloseTo(0.5);
    expect(resolveParticleFrameScale(1 / 30)).toBeCloseTo(1);
    expect(resolveParticleFrameScale(1)).toBeCloseTo(1.5);
    expect(resolveParticleFrameScale(Number.NaN)).toBe(0);
  });

  it("caps accumulated orbital velocity during long-running sessions", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);

    const particle = makeParticle({ x: 180, y: 128 });
    const cap = resolveParticleVelocityCap(1, 0);

    for (let i = 0; i < 900; i += 1) {
      updateParticles([particle], 1, 128, 128, 30, 70, 0, 1 / 30);
      const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
      expect(speed).toBeLessThanOrEqual(cap + 1e-9);
    }
  });

  it("uses dt so 60fps and 30fps sessions advance particles at comparable speed", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75);

    const at30 = makeParticle({ x: 180, y: 128, vx: 0.2, vy: 0.1 });
    const at60 = makeParticle({ x: 180, y: 128, vx: 0.2, vy: 0.1 });

    for (let i = 0; i < 30; i += 1) {
      updateParticles([at30], 0.5, 128, 128, 30, 70, 0, 1 / 30);
    }

    for (let i = 0; i < 60; i += 1) {
      updateParticles([at60], 0.5, 128, 128, 30, 70, 0, 1 / 60);
    }

    expect(at60.x).toBeCloseTo(at30.x, 0);
    expect(at60.y).toBeCloseTo(at30.y, 0);
  });
});
