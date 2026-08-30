import type { Particle } from "./particleSystem";

export function reprojectOrbParticles(
  particles: Particle[],
  previousSize: number,
  nextSize: number
): boolean {
  if (
    !Number.isFinite(previousSize) ||
    previousSize <= 0 ||
    !Number.isFinite(nextSize) ||
    nextSize <= 0
  ) {
    return false;
  }

  if (previousSize === nextSize) return true;

  const ratio = nextSize / previousSize;
  for (const particle of particles) {
    particle.x *= ratio;
    particle.y *= ratio;
    particle.vx *= ratio;
    particle.vy *= ratio;
    particle.radius *= ratio;
  }

  return true;
}
