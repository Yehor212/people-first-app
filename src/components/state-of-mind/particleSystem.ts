/**
 * Particle system for ValenceOrb.
 * Fixed-size pool, recycled in-place — zero allocations in hot path.
 *
 * Valence controls legacy particle behavior:
 *   Negative → erratic, fast scatter, wider spread
 *   Neutral  → moderate drift
 *   Positive → slow orbital drift, gentle movement
 *
 * Phase 3-B.2 Task E — Theme-aware particle fields (pollen/wisps/embers):
 *   paper → pollen: soft golden dust, gentle upward drift (~20 particles)
 *   ink   → wisps:  cosmic violet orbital streams (~40 particles)
 *   oled  → embers: hot sparks, rapid burst+fade (~50 particles)
 *
 * Motion is driven by theme-specific variant + valence still modulates speed.
 * Existing `createParticlePool`/`updateParticles`/`burstParticles` signatures
 * are preserved for backward compatibility with the legacy render path; three
 * new pool/update helpers are added and exported.
 */

export type ParticleVariant = 'legacy' | 'pollen' | 'wisps' | 'embers';

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
  /** Theme variant — optional (legacy path leaves unset) */
  variant?: ParticleVariant;
  /** Per-particle offset for smooth oscillations (phase for sine wobble) */
  phase?: number;
  /** Initial spawn radius (wisps keep a stable orbital baseline) */
  baseRadius?: number;
  /** Initial angle (wisps orbit) */
  baseAngle?: number;
  /** Angular velocity (wisps) */
  angularVel?: number;
}

/** Variant palette — OKLCH-derived fixed tuples kept here to avoid a theme-store dep
 *  inside the pure math module. Hue/sat/light expressed in HSL for cheap canvas fill. */
export interface VariantPalette {
  /** Core hue in degrees (0-360) */
  hue: number;
  /** Saturation 0-100 */
  sat: number;
  /** Base lightness 0-100 */
  light: number;
  /** Hue spread applied per-particle (+/-) for gentle variation */
  hueSpread: number;
}

const PALETTES: Record<Exclude<ParticleVariant, 'legacy'>, VariantPalette> = {
  // Pollen: warm amber/gold — matches paper accent tokens
  pollen: { hue: 45, sat: 70, light: 72, hueSpread: 12 },
  // Wisps: cosmic violet — matches ink accent
  wisps:  { hue: 270, sat: 55, light: 65, hueSpread: 18 },
  // Embers: hot red/orange core — matches oled alert tokens
  embers: { hue: 18, sat: 90, light: 58, hueSpread: 14 },
};

/** Lookup helper — exported for renderer use */
export function getVariantPalette(variant: ParticleVariant): VariantPalette | null {
  if (variant === 'legacy') return null;
  return PALETTES[variant];
}

// ─────────────────────────────────────────────────────────────────
// LEGACY (original) API — preserved for backward compatibility
// ─────────────────────────────────────────────────────────────────

/** Spawn a single legacy particle at a random position in the spawn ring */
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
    variant: 'legacy',
  };
}

/** Create initial particle pool (LEGACY — variant-unaware) */
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
    p.vx = (Math.random() - 0.5) * 1.2;
    p.vy = (Math.random() - 0.5) * 1.2;
    p.radius = 3.0 + Math.random() * 4.0;
    p.alpha = 0.8;
    p.life = 0;
    p.maxLife = 25 + Math.floor(Math.random() * 15);
    p.hueOffset = (Math.random() - 0.5) * 40;
  }
}

/** Update all legacy particles in-place. */
export function updateParticles(
  particles: Particle[],
  valence: number,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  calmFactor = 0,
): void {
  const speedMult = (1.5 - valence) * (1 - calmFactor * 0.5);
  const jitter = (1 - valence) * 0.15 * (1 - calmFactor * 0.7);

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    // Skip theme-variant particles — they use updateVariantParticles
    if (p.variant && p.variant !== 'legacy') continue;
    p.life++;

    if (p.life >= p.maxLife) {
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

    const lifeRatio = p.life / p.maxLife;
    if (lifeRatio < 0.2) {
      p.alpha = lifeRatio / 0.2;
    } else if (lifeRatio > 0.7) {
      p.alpha = (1 - lifeRatio) / 0.3;
    } else {
      p.alpha = 1;
    }

    p.vx += (Math.random() - 0.5) * jitter;
    p.vy += (Math.random() - 0.5) * jitter;

    if (valence > 0) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const tangentX = -dy / dist;
      const tangentY = dx / dist;
      p.vx += tangentX * 0.02 * valence;
      p.vy += tangentY * 0.02 * valence;
    }

    p.x += p.vx * speedMult;
    p.y += p.vy * speedMult;

    p.vx *= 0.97;
    p.vy *= 0.97;
  }
}

// ─────────────────────────────────────────────────────────────────
// Phase 3-B.2 Task E — Theme-aware variants
// ─────────────────────────────────────────────────────────────────

/** Per-variant recommended pool size (120 max ceiling honored by callers) */
export const VARIANT_COUNTS: Record<Exclude<ParticleVariant, 'legacy'>, number> = {
  pollen: 20,
  wisps: 40,
  embers: 50,
};

/** Spawn a single pollen particle — base of orb, drifts upward with sine wobble. */
function spawnPollen(cx: number, cy: number, outerR: number): Particle {
  const spreadX = outerR * 1.6;
  return {
    x: cx + (Math.random() - 0.5) * spreadX,
    y: cy + outerR * (0.4 + Math.random() * 0.3), // start below orb center
    vx: (Math.random() - 0.5) * 0.08,
    vy: -(0.25 + Math.random() * 0.35), // always upward
    radius: 1.2 + Math.random() * 1.8,
    alpha: 0,
    life: 0,
    maxLife: 180 + Math.floor(Math.random() * 60), // ~6-8s at 30fps
    hueOffset: (Math.random() - 0.5) * PALETTES.pollen.hueSpread,
    variant: 'pollen',
    phase: Math.random() * Math.PI * 2,
    baseRadius: outerR,
  };
}

/** Spawn a single wisp — orbital around orb center. Never dies (infinite lifetime). */
function spawnWisp(cx: number, cy: number, outerR: number): Particle {
  const orbitR = outerR * (1.15 + Math.random() * 0.45);
  const angle = Math.random() * Math.PI * 2;
  return {
    x: cx + Math.cos(angle) * orbitR,
    y: cy + Math.sin(angle) * orbitR,
    vx: 0,
    vy: 0,
    radius: 1.5 + Math.random() * 2.2,
    alpha: 0.35 + Math.random() * 0.3,
    life: 0,
    maxLife: Number.POSITIVE_INFINITY, // infinite — alpha breathes, position orbits
    hueOffset: (Math.random() - 0.5) * PALETTES.wisps.hueSpread,
    variant: 'wisps',
    phase: Math.random() * Math.PI * 2,
    baseRadius: orbitR,
    baseAngle: angle,
    angularVel: 0.004 + Math.random() * 0.006, // slow orbit ~6-14s per revolution
  };
}

/** Spawn a single ember — burst from random point in orb aura. */
function spawnEmber(cx: number, cy: number, outerR: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const dist = outerR * (0.15 + Math.random() * 0.65);
  const speed = 0.6 + Math.random() * 1.0;
  return {
    x: cx + Math.cos(angle) * dist,
    y: cy + Math.sin(angle) * dist,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 1.6 + Math.random() * 2.6,
    alpha: 1.0,
    life: 0,
    maxLife: 30 + Math.floor(Math.random() * 10), // ~1.0-1.3s at 30fps
    hueOffset: (Math.random() - 0.5) * PALETTES.embers.hueSpread,
    variant: 'embers',
    baseRadius: outerR,
  };
}

/**
 * Create a pool for a theme variant. Particles may exceed `count` cap but are
 * clamped to the 120-active-particle budget (Law 8 perf).
 */
export function createVariantPool(
  variant: ParticleVariant,
  count: number,
  cx: number,
  cy: number,
  outerR: number,
): Particle[] {
  if (variant === 'legacy') {
    // Delegate to legacy ring-spawner with derived innerR
    return createParticlePool(count, cx, cy, outerR * 0.6, outerR);
  }

  const particles: Particle[] = [];
  const clamped = Math.max(0, Math.min(count, 120));
  for (let i = 0; i < clamped; i++) {
    let p: Particle;
    if (variant === 'pollen') p = spawnPollen(cx, cy, outerR);
    else if (variant === 'wisps') p = spawnWisp(cx, cy, outerR);
    else p = spawnEmber(cx, cy, outerR);

    // Stagger initial life so spawns don't bunch
    if (Number.isFinite(p.maxLife)) {
      p.life = Math.floor(Math.random() * p.maxLife);
    }
    particles.push(p);
  }
  return particles;
}

/**
 * Update a variant pool in-place. Recycles dead particles (except wisps which
 * are infinite-lifetime). `dt` in seconds (frame-rate independent).
 */
export function updateVariantParticles(
  particles: Particle[],
  variant: ParticleVariant,
  cx: number,
  cy: number,
  outerR: number,
  dt: number,
): void {
  if (variant === 'legacy') return;

  // dt is in seconds; legacy system was 30fps-centric, so scale by 30 for "frames"
  const frames = dt * 30;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.variant !== variant) continue;

    if (variant === 'pollen') {
      p.life += frames;
      if (p.life >= p.maxLife) {
        const respawned = spawnPollen(cx, cy, outerR);
        Object.assign(p, respawned);
        continue;
      }
      const ratio = p.life / p.maxLife;
      // Fade in first 15%, hold, fade out last 25%
      if (ratio < 0.15) p.alpha = ratio / 0.15;
      else if (ratio > 0.75) p.alpha = Math.max(0, (1 - ratio) / 0.25);
      else p.alpha = 1;

      // Lateral wobble: sine of (life + phase)
      const wobble = Math.sin(p.life * 0.05 + (p.phase ?? 0)) * 0.12;
      p.x += (p.vx + wobble) * frames;
      p.y += p.vy * frames;
    } else if (variant === 'wisps') {
      p.life += frames;
      // Infinite lifetime — orbit around center, breathe alpha, never respawn
      const baseAngle = p.baseAngle ?? 0;
      const angularVel = p.angularVel ?? 0.005;
      const newAngle = baseAngle + angularVel * p.life;
      // Radius wobble for elliptical feel
      const rWobble = 1 + Math.sin(p.life * 0.03 + (p.phase ?? 0)) * 0.08;
      const r = (p.baseRadius ?? outerR) * rWobble;
      p.x = cx + Math.cos(newAngle) * r;
      p.y = cy + Math.sin(newAngle) * r;
      // Alpha breathe 0.25..0.75
      p.alpha = 0.35 + Math.sin(p.life * 0.04 + (p.phase ?? 0)) * 0.25;
    } else {
      // embers
      p.life += frames;
      if (p.life >= p.maxLife) {
        const respawned = spawnEmber(cx, cy, outerR);
        Object.assign(p, respawned);
        continue;
      }
      const ratio = p.life / p.maxLife;
      // Exponential decay for dramatic fade
      p.alpha = Math.pow(1 - ratio, 1.5);
      // Scale decay (radius shrinks toward 0.4x)
      const scale = 1 - ratio * 0.6;
      p.radius = Math.max(0.4, (p.radius ?? 1) * Math.pow(0.985, frames));
      // Velocity damping
      p.vx *= Math.pow(0.96, frames);
      p.vy *= Math.pow(0.96, frames);
      p.x += p.vx * frames;
      p.y += p.vy * frames;
      // Subtle upward buoyancy (sparks rise)
      p.vy -= 0.015 * frames;
      // Radius fade-with-scale
      void scale;
    }
  }
}

/**
 * Render theme-variant particles to a 2D canvas context. Cheap additive blend.
 * Called by ValenceOrb's particle layer (separate canvas above orb).
 */
export function drawVariantParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  variant: ParticleVariant,
  dpr: number,
): void {
  if (variant === 'legacy') return;
  const pal = PALETTES[variant];
  if (!pal) return;

  ctx.save();
  ctx.scale(dpr, dpr);
  // Additive blend for glow — 'lighter' is cheap and broadly supported
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.variant !== variant || p.alpha <= 0.01 || p.radius <= 0.1) continue;

    const h = (pal.hue + (p.hueOffset ?? 0) + 360) % 360;
    const s = pal.sat;
    const l = pal.light;
    // Soft radial gradient — bright core + faded halo
    const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3);
    grd.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, ${p.alpha})`);
    grd.addColorStop(0.4, `hsla(${h}, ${s}%, ${l}%, ${p.alpha * 0.4})`);
    grd.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
