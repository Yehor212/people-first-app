/**
 * Particle system for ValenceOrb.
 * Fixed-size pool, recycled in-place — zero allocations in hot path.
 *
 * Valence controls particle behavior:
 *   Negative → erratic, fast scatter, wider spread
 *   Neutral  → moderate drift
 *   Positive → slow orbital drift, gentle movement
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
  hueOffset: number;
}

/** Spawn a single particle at a random position in the spawn ring */
function spawnParticle(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
): Particle {
  const angle = Math.random() * Math.PI * 2;
  const dist = innerR + Math.random() * (outerR - innerR);
  return {
    x: cx + Math.cos(angle) * dist,
    y: cy + Math.sin(angle) * dist,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    radius: 2.0 + Math.random() * 3.5,
    alpha: 0,
    life: 0,
    maxLife: 60 + Math.floor(Math.random() * 60), // 2-4s at 30fps
    hueOffset: (Math.random() - 0.5) * 30, // ±15° hue variation
  };
}

/** Create initial particle pool */
export function createParticlePool(
  count: number,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const p = spawnParticle(cx, cy, innerR, outerR);
    // Stagger initial life so particles don't all spawn at once
    p.life = Math.floor(Math.random() * p.maxLife);
    particles.push(p);
  }
  return particles;
}

/**
 * Force-respawn a batch of particles with burst velocity.
 * Used by P3 Transition Dramatics — shimmer burst on large valence change.
 */
export function burstParticles(
  particles: Particle[],
  count: number,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
): void {
  const n = Math.min(count, particles.length);
  // Pick the oldest particles (highest life/maxLife ratio) for recycling
  const indices = particles
    .map((p, i) => ({ i, ratio: p.life / p.maxLife }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, n)
    .map(e => e.i);

  for (const idx of indices) {
    const p = particles[idx];
    const angle = Math.random() * Math.PI * 2;
    const dist = innerR + Math.random() * (outerR - innerR) * 0.5;
    p.x = cx + Math.cos(angle) * dist;
    p.y = cy + Math.sin(angle) * dist;
    p.vx = (Math.random() - 0.5) * 1.2; // 3× normal velocity
    p.vy = (Math.random() - 0.5) * 1.2;
    p.radius = 3.0 + Math.random() * 4.0;
    p.alpha = 0.8; // start bright
    p.life = 0;
    p.maxLife = 25 + Math.floor(Math.random() * 15); // short burst (~0.8-1.3s at 30fps)
    p.hueOffset = (Math.random() - 0.5) * 40;
  }
}

/** Update all particles in-place. Recycle dead particles. */
export function updateParticles(
  particles: Particle[],
  valence: number,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  calmFactor = 0,
): void {
  // Valence-driven behavior parameters
  const speedMult = (1.5 - valence) * (1 - calmFactor * 0.5); // idle → 50% slower
  const jitter = (1 - valence) * 0.15 * (1 - calmFactor * 0.7); // idle → 70% less jitter

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.life++;

    if (p.life >= p.maxLife) {
      // Recycle: respawn at new position in ring
      const respawned = spawnParticle(cx, cy, innerR, outerR);
      p.x = respawned.x;
      p.y = respawned.y;
      p.vx = respawned.vx;
      p.vy = respawned.vy;
      p.radius = respawned.radius;
      p.life = 0;
      p.maxLife = respawned.maxLife;
      p.hueOffset = respawned.hueOffset;
      p.alpha = 0;
      continue;
    }

    // Alpha: fade in first 20%, hold, fade out last 30%
    const lifeRatio = p.life / p.maxLife;
    if (lifeRatio < 0.2) {
      p.alpha = lifeRatio / 0.2;
    } else if (lifeRatio > 0.7) {
      p.alpha = (1 - lifeRatio) / 0.3;
    } else {
      p.alpha = 1;
    }

    // Add jitter for negative valence
    p.vx += (Math.random() - 0.5) * jitter;
    p.vy += (Math.random() - 0.5) * jitter;

    // Gentle tangential drift for positive valence (orbital feel)
    if (valence > 0) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      // Tangential force (perpendicular to radial)
      const tangentX = -dy / dist;
      const tangentY = dx / dist;
      p.vx += tangentX * 0.02 * valence;
      p.vy += tangentY * 0.02 * valence;
    }

    // Apply velocity with speed multiplier
    p.x += p.vx * speedMult;
    p.y += p.vy * speedMult;

    // Damping to prevent runaway velocity
    p.vx *= 0.97;
    p.vy *= 0.97;
  }
}
