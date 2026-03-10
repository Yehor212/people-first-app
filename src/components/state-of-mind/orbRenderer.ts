/**
 * Pure draw functions for the ValenceOrb canvas.
 *
 * SUPERFORMULA + ROSE CURVE architecture:
 *   r(θ) = (|cos(mθ/4)|^n2 + |sin(mθ/4)|^n3)^(-1/n1)
 *
 * Shape morphing driven by valence (-1 → +1):
 *   -1.0 → 8-pointed spiky star  (n1=0.30, n2=n3=0.35)
 *   -0.5 → 7-pointed angular form (n1=0.55, n2=n3=0.70)
 *    0.0 → smooth circle          (n1=n2=n3=2.0)
 *   +0.5 → subtle 5-fold shape    (n1=1.10, n2=n3=1.90)
 *   +1.0 → puffy 5-petal flower   (n1=0.55, n2=n3=1.75)
 *
 * PREMIUM RENDERING PHILOSOPHY:
 *   Every shape is a luminous volumetric object, not a wireframe sketch.
 *   Rich gradient fills create depth. Multiple glow layers create bloom.
 *   Additive blending creates the illusion of emitted light.
 *
 * 9 visual layers (back to front):
 *   1. Deep Aura — wide diffuse ambient glow
 *   2. Shape Glow Shadow — soft under-shape for depth
 *   3. Outer Shape Ring — rich gradient fill + soft glow stroke
 *   4. Middle Shape Ring — counter-rotated, brighter fill
 *   5. Inner Shape Ring — most opaque, strongest color
 *   6. Rose Curve Overlay — thin inner mandala lines
 *   7. Luminous Core — large bright center with bloom
 *   8. Bloom Overlay — additive light pass for premium glow
 *   9. Particles — soft floating glow orbs
 */

import { noise2d } from './noise2d';
import { valenceToHSL } from './colorUtils';
import type { Particle } from './particleSystem';

export interface OrbSceneParams {
  valence: number;
  time: number;
  particles: Particle[];
  size: number;
  dpr: number;
  isDark: boolean;
}

// ── Shape Parameters ──

interface ShapeParams {
  m: number;
  n1: number;
  n2: number;
  n3: number;
}

/**
 * 5-stop preset system for superformula parameters.
 * Interpolated the same way as colorUtils (lerp between adjacent stops).
 */
const SHAPE_PRESETS: { valence: number; p: ShapeParams }[] = [
  { valence: -1.0, p: { m: 8, n1: 0.30, n2: 0.35, n3: 0.35 } }, // spiky urchin
  { valence: -0.5, p: { m: 7, n1: 0.55, n2: 0.70, n3: 0.70 } }, // angular star
  { valence:  0.0, p: { m: 6, n1: 2.00, n2: 2.00, n3: 2.00 } }, // perfect circle
  { valence:  0.5, p: { m: 5, n1: 1.10, n2: 1.90, n3: 1.90 } }, // subtle 5-fold
  { valence:  1.0, p: { m: 5, n1: 0.55, n2: 1.75, n3: 1.75 } }, // puffy flower
];

function getShapeParams(valence: number): ShapeParams {
  const v = Math.max(-1, Math.min(1, valence));

  let lower = SHAPE_PRESETS[0];
  let upper = SHAPE_PRESETS[SHAPE_PRESETS.length - 1];

  for (let i = 0; i < SHAPE_PRESETS.length - 1; i++) {
    if (v >= SHAPE_PRESETS[i].valence && v <= SHAPE_PRESETS[i + 1].valence) {
      lower = SHAPE_PRESETS[i];
      upper = SHAPE_PRESETS[i + 1];
      break;
    }
  }

  const range = upper.valence - lower.valence;
  const t = range === 0 ? 0 : (v - lower.valence) / range;

  return {
    m:  lower.p.m  + (upper.p.m  - lower.p.m)  * t,
    n1: lower.p.n1 + (upper.p.n1 - lower.p.n1) * t,
    n2: lower.p.n2 + (upper.p.n2 - lower.p.n2) * t,
    n3: lower.p.n3 + (upper.p.n3 - lower.p.n3) * t,
  };
}

// ── Helpers ──

function mapRange(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = (v - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a.toFixed(3)})`;
}

// ── Superformula Core ──

/** Gielis superformula: returns radius multiplier in ~[0.1, 1.0] */
function superformula(theta: number, m: number, n1: number, n2: number, n3: number): number {
  const alpha = m * theta / 4;
  const cosA = Math.abs(Math.cos(alpha));
  const sinA = Math.abs(Math.sin(alpha));
  const t1 = Math.pow(cosA, n2);
  const t2 = Math.pow(sinA, n3);
  const sum = t1 + t2;
  if (sum < 1e-10) return 1; // safety
  return Math.pow(sum, -1 / n1);
}

// ── Shape Constants ──

/** Points per ring — 72 for smooth curves even with 8-lobe stars */
const SHAPE_POINTS = 72;

// ── Polar Shape Generation ──

/**
 * Generate points using superformula + 2-octave noise.
 * Returns array of [x,y] for smooth path tracing.
 */
function computeShapePoints(
  cx: number,
  cy: number,
  baseRadius: number,
  shape: ShapeParams,
  time: number,
  rotationOffset: number,
  breathScale: number,
  noiseAmp: number,
  noiseSpeed: number,
  seed: number,
): [number, number][] {
  const points: [number, number][] = [];
  const mInt = Math.round(shape.m); // integer m for clean closure

  for (let i = 0; i < SHAPE_POINTS; i++) {
    const angle = (i / SHAPE_POINTS) * Math.PI * 2 + rotationOffset;

    // Superformula radius
    const sf = superformula(angle, mInt, shape.n1, shape.n2, shape.n3);

    // 2-octave noise for organic asymmetry
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const nv1 = noise2d(
      cosA * 2.5 + time * noiseSpeed + seed,
      sinA * 2.5 + time * noiseSpeed * 0.7 + seed,
    );
    const nv2 = noise2d(
      cosA * 5.0 + time * noiseSpeed * 1.3 + seed + 100,
      sinA * 5.0 + time * noiseSpeed * 0.9 + seed + 100,
    );
    const noiseDisp = (nv1 * 0.7 + nv2 * 0.3) * noiseAmp;

    const r = baseRadius * sf * (1 + noiseDisp) * breathScale;

    points.push([cx + cosA * r, cy + sinA * r]);
  }

  return points;
}

/**
 * Smooth closed path via quadraticCurveTo midpoint interpolation.
 * Proven pattern from GrowthRingsCanvas — organic smooth curves.
 */
function traceShapePath(ctx: CanvasRenderingContext2D, points: [number, number][]) {
  const n = points.length;
  ctx.beginPath();

  const startMidX = (points[n - 1][0] + points[0][0]) / 2;
  const startMidY = (points[n - 1][1] + points[0][1]) / 2;
  ctx.moveTo(startMidX, startMidY);

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const midX = (points[i][0] + points[next][0]) / 2;
    const midY = (points[i][1] + points[next][1]) / 2;
    ctx.quadraticCurveTo(points[i][0], points[i][1], midX, midY);
  }
  ctx.closePath();
}

// ── Layer 1: Deep Aura (wide ambient glow) ──

function drawAura(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hsl: { h: number; s: number; l: number },
  time: number,
  isDark: boolean,
) {
  const baseAlpha = isDark ? 0.28 : 0.18;
  const breathAlpha = baseAlpha + Math.sin(time * 0.8) * 0.04;

  // Primary wide glow
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, hsla(hsl.h, hsl.s * 0.7, hsl.l + 20, breathAlpha * 2.2));
  g.addColorStop(0.15, hsla(hsl.h, hsl.s * 0.6, hsl.l + 15, breathAlpha * 1.6));
  g.addColorStop(0.35, hsla(hsl.h, hsl.s * 0.5, hsl.l + 10, breathAlpha * 0.9));
  g.addColorStop(0.6, hsla(hsl.h, hsl.s * 0.35, hsl.l + 5, breathAlpha * 0.35));
  g.addColorStop(1, hsla(hsl.h, hsl.s * 0.2, hsl.l, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  // Drifting sub-gradient for color shimmer (hue offset)
  const phase = time * 0.18;
  const offsetX = noise2d(phase, 50) * radius * 0.10;
  const offsetY = noise2d(50, phase) * radius * 0.10;
  const subR = radius * 0.65;
  const subAlpha = breathAlpha * 0.55;

  const g2 = ctx.createRadialGradient(
    cx + offsetX, cy + offsetY, 0,
    cx + offsetX, cy + offsetY, subR,
  );
  g2.addColorStop(0, hsla(hsl.h + 25, hsl.s * 0.9, hsl.l + 25, subAlpha));
  g2.addColorStop(0.4, hsla(hsl.h + 25, hsl.s * 0.6, hsl.l + 12, subAlpha * 0.5));
  g2.addColorStop(1, hsla(hsl.h + 25, hsl.s, hsl.l, 0));
  ctx.fillStyle = g2;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  // Third sub-glow for extra vibrancy in dark mode
  if (isDark) {
    const phase2 = time * 0.14 + 3.0;
    const ox2 = noise2d(phase2 + 200, 80) * radius * 0.08;
    const oy2 = noise2d(80, phase2 + 200) * radius * 0.08;
    const g3 = ctx.createRadialGradient(
      cx + ox2, cy + oy2, 0,
      cx + ox2, cy + oy2, subR * 0.8,
    );
    g3.addColorStop(0, hsla(hsl.h - 15, hsl.s * 0.7, hsl.l + 18, subAlpha * 0.4));
    g3.addColorStop(1, hsla(hsl.h - 15, hsl.s * 0.4, hsl.l, 0));
    ctx.fillStyle = g3;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }
}

// ── Layers 3-5: Shape Rings (RICH gradient fills) ──

/**
 * Draw one concentric ring: superformula shape + rich gradient fill + dual-stroke edges.
 */
function drawShapeRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  shape: ShapeParams,
  time: number,
  rotation: number,
  breathScale: number,
  fillAlpha: number,
  edgeAlpha: number,
  hsl: { h: number; s: number; l: number },
  noiseAmp: number,
  noiseSpeed: number,
  isDark: boolean,
  hueShift: number,
  seed: number,
) {
  const h = hsl.h + hueShift;

  const points = computeShapePoints(
    cx, cy, baseRadius, shape, time, rotation,
    breathScale, noiseAmp, noiseSpeed, seed,
  );

  // Rich radial gradient fill — center offset toward light source (top-left)
  const lightOffX = -baseRadius * 0.12;
  const lightOffY = -baseRadius * 0.12;
  const gradOuter = baseRadius * 1.15;
  const grad = ctx.createRadialGradient(
    cx + lightOffX, cy + lightOffY, baseRadius * 0.02,
    cx, cy, gradOuter,
  );
  const coreLightness = isDark ? Math.min(98, hsl.l + 40) : Math.min(96, hsl.l + 32);
  grad.addColorStop(0, hsla(h, hsl.s * 0.4, coreLightness, fillAlpha));
  grad.addColorStop(0.15, hsla(h, hsl.s * 0.7, hsl.l + 25, fillAlpha * 0.92));
  grad.addColorStop(0.35, hsla(h, hsl.s * 0.85, hsl.l + 15, fillAlpha * 0.75));
  grad.addColorStop(0.55, hsla(h, hsl.s * 0.8, hsl.l + 8, fillAlpha * 0.50));
  grad.addColorStop(0.75, hsla(h, hsl.s * 0.6, hsl.l + 3, fillAlpha * 0.25));
  grad.addColorStop(1, hsla(h, hsl.s * 0.4, hsl.l, fillAlpha * 0.04));

  // Trace path → fill with rich gradient
  traceShapePath(ctx, points);
  ctx.fillStyle = grad;
  ctx.fill();

  // Outer glow stroke — soft, wide, for atmosphere
  const glowL = isDark ? Math.min(98, hsl.l + 35) : Math.min(96, hsl.l + 28);
  ctx.strokeStyle = hsla(h, hsl.s * 0.3, glowL, edgeAlpha * 0.4);
  ctx.lineWidth = baseRadius * 0.04;
  ctx.stroke();

  // Inner crisp edge — thin, bright, for definition
  const rimL = isDark ? Math.min(99, hsl.l + 45) : Math.min(97, hsl.l + 35);
  traceShapePath(ctx, points);
  ctx.strokeStyle = hsla(h, hsl.s * 0.25, rimL, edgeAlpha * 0.85);
  ctx.lineWidth = baseRadius * 0.015;
  ctx.stroke();
}

// ── Layer 6: Rose Curve Overlay ──

/**
 * Thin semi-transparent rose curve r = cos(k·θ) traced as inner mandala lines.
 * k varies with valence: complex fractions (negative) → clean integers (positive).
 */
function drawRoseCurve(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  valence: number,
  time: number,
  hsl: { h: number; s: number; l: number },
  isDark: boolean,
) {
  // k mapping: complex (negative) → simple (positive)
  const k = mapRange(valence, -1, 1, 2.333, 5.0);
  const roseAlpha = isDark ? 0.18 : 0.12;

  // Slow independent rotation
  const roseRotation = time * 0.04;

  const numPoints = 300;
  // Trace 3 full turns — enough for any rational k with small denominator
  const maxTheta = Math.PI * 6;

  ctx.beginPath();
  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * maxTheta + roseRotation;
    const r = Math.cos(k * theta) * radius;
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.strokeStyle = hsla(hsl.h, hsl.s * 0.4, Math.min(97, hsl.l + 30), roseAlpha);
  ctx.lineWidth = radius * 0.016;
  ctx.stroke();
}

// ── Layer 7: Luminous Core (large, with bloom) ──

function drawCore(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hsl: { h: number; s: number; l: number },
  time: number,
  isDark: boolean,
) {
  const breathScale = 1 + Math.sin(time * 1.2) * 0.05;
  const r = radius * breathScale;
  const coreAlpha = isDark ? 0.97 : 0.95;

  // Offset gradient center toward light source
  const grad = ctx.createRadialGradient(
    cx - r * 0.15, cy - r * 0.15, 0,
    cx, cy, r,
  );
  grad.addColorStop(0, hsla(hsl.h, hsl.s * 0.10, 99, coreAlpha));
  grad.addColorStop(0.10, hsla(hsl.h, hsl.s * 0.20, 97, coreAlpha * 0.95));
  grad.addColorStop(0.25, hsla(hsl.h, hsl.s * 0.45, 90, coreAlpha * 0.85));
  grad.addColorStop(0.45, hsla(hsl.h, hsl.s * 0.70, hsl.l + 25, coreAlpha * 0.60));
  grad.addColorStop(0.70, hsla(hsl.h, hsl.s * 0.85, hsl.l + 12, coreAlpha * 0.25));
  grad.addColorStop(1, hsla(hsl.h, hsl.s, hsl.l + 5, 0));

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Inner depth dot — subtle dark anchor for 3D feel
  const dotR = r * 0.06;
  const dotAlpha = isDark ? 0.18 : 0.10;
  ctx.beginPath();
  ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
  ctx.fillStyle = hsla(hsl.h, hsl.s * 0.5, Math.max(5, hsl.l - 20), dotAlpha);
  ctx.fill();
}

// ── Layer 8: Bloom Overlay (additive light pass) ──

function drawBloom(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hsl: { h: number; s: number; l: number },
  time: number,
  isDark: boolean,
) {
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';

  const bloomAlpha = (isDark ? 0.10 : 0.06) + Math.sin(time * 0.7) * 0.015;
  const bloomR = radius;

  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomR);
  g.addColorStop(0, hsla(hsl.h, hsl.s * 0.3, 95, bloomAlpha * 1.8));
  g.addColorStop(0.2, hsla(hsl.h, hsl.s * 0.5, hsl.l + 30, bloomAlpha * 1.2));
  g.addColorStop(0.5, hsla(hsl.h, hsl.s * 0.6, hsl.l + 15, bloomAlpha * 0.5));
  g.addColorStop(1, hsla(hsl.h, hsl.s * 0.4, hsl.l, 0));

  ctx.beginPath();
  ctx.arc(cx, cy, bloomR, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.globalCompositeOperation = prevComposite;
}

// ── Layer 9: Particles (soft glow orbs) ──

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  hsl: { h: number; s: number; l: number },
  dpr: number,
  isDark: boolean,
) {
  const alphaBoost = isDark ? 0.25 : 0.10;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.alpha <= 0.01) continue;

    const px = p.x * dpr;
    const py = p.y * dpr;
    const pr = p.radius * dpr * 2.2;  // 60% larger than before
    const pa = Math.min(1, p.alpha * 0.85 + alphaBoost);

    // Soft glow orb — near-white center → colored middle → transparent edge
    const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    grad.addColorStop(0, hsla(hsl.h, hsl.s * 0.15, 98, pa));
    grad.addColorStop(0.20, hsla(hsl.h, hsl.s * 0.35, 92, pa * 0.70));
    grad.addColorStop(0.50, hsla(hsl.h, hsl.s * 0.55, hsl.l + 20, pa * 0.35));
    grad.addColorStop(1, hsla(hsl.h, hsl.s, hsl.l, 0));

    ctx.fillStyle = grad;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }
}

// ── Layer 2: Shape Glow Shadow (depth anchor beneath shapes) ──

function drawShapeShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  shape: ShapeParams,
  time: number,
  rotation: number,
  breathScale: number,
  hsl: { h: number; s: number; l: number },
  noiseAmp: number,
  noiseSpeed: number,
) {
  const points = computeShapePoints(
    cx, cy, baseRadius * 1.08, shape, time, rotation,
    breathScale, noiseAmp * 0.6, noiseSpeed * 0.5, 200,
  );

  const shadowAlpha = 0.18;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 1.3);
  grad.addColorStop(0, hsla(hsl.h, hsl.s * 0.5, hsl.l + 15, shadowAlpha * 0.8));
  grad.addColorStop(0.4, hsla(hsl.h, hsl.s * 0.4, hsl.l + 8, shadowAlpha * 0.4));
  grad.addColorStop(1, hsla(hsl.h, hsl.s * 0.3, hsl.l, 0));

  traceShapePath(ctx, points);
  ctx.fillStyle = grad;
  ctx.fill();
}

// ── Main Scene Composer ──

export function drawOrbScene(
  ctx: CanvasRenderingContext2D,
  params: OrbSceneParams,
): void {
  const { valence, time, particles, size, dpr, isDark } = params;
  const w = size * dpr;
  const h = size * dpr;
  const cx = w / 2;
  const cy = h / 2;

  const hsl = valenceToHSL(valence);
  const shape = getShapeParams(valence);

  ctx.clearRect(0, 0, w, h);

  // ── Valence-driven animation parameters ──
  const noiseAmp = 0.05 + Math.abs(valence) * 0.03;
  const noiseSpeed = mapRange(valence, -1, 1, 0.85, 0.20);
  const rotSpeed = mapRange(valence, -1, 1, 0.055, 0.015);

  const baseRadius = size * 0.38 * dpr;

  // ── Layered breath animation (wave from outer to inner) ──
  const outerBreath = 1 + Math.sin(time * 0.9) * 0.025;
  const midBreath   = 1 + Math.sin(time * 0.9 + 1.0) * 0.020;
  const innerBreath = 1 + Math.sin(time * 0.9 + 2.0) * 0.015;

  // Layer 1: Deep aura (wider, stronger)
  drawAura(ctx, cx, cy, baseRadius * 1.85, hsl, time, isDark);

  // Layer 2: Shape glow shadow (depth beneath main shapes)
  drawShapeShadow(
    ctx, cx, cy, baseRadius * 1.0, shape, time,
    time * rotSpeed, outerBreath, hsl,
    noiseAmp, noiseSpeed,
  );

  // Layer 3: Outer shape ring — largest, rich fill, glass edges
  drawShapeRing(
    ctx, cx, cy,
    baseRadius * 1.05, shape, time,
    time * rotSpeed,            // slow clockwise
    outerBreath,
    isDark ? 0.38 : 0.30,      // fill alpha — rich, visible
    isDark ? 0.50 : 0.38,      // edge alpha — visible glow
    hsl, noiseAmp, noiseSpeed,
    isDark, 6, 0,               // hueShift=+6, seed=0
  );

  // Layer 4: Middle shape ring — counter-rotated for depth
  drawShapeRing(
    ctx, cx, cy,
    baseRadius * 0.78, shape, time,
    -time * rotSpeed * 0.55,    // counter-rotation
    midBreath,
    isDark ? 0.52 : 0.44,      // fill alpha — strong
    isDark ? 0.55 : 0.42,      // edge alpha
    hsl, noiseAmp * 0.7, noiseSpeed * 0.8,
    isDark, -8, 50,
  );

  // Layer 5: Inner shape ring — smallest, most opaque
  drawShapeRing(
    ctx, cx, cy,
    baseRadius * 0.55, shape, time,
    time * rotSpeed * 0.3,      // very slow rotation
    innerBreath,
    isDark ? 0.70 : 0.62,      // fill alpha — solid presence
    isDark ? 0.60 : 0.48,      // edge alpha
    hsl, noiseAmp * 0.5, noiseSpeed * 0.6,
    isDark, 0, 100,
  );

  // Layer 6: Rose curve overlay (thin inner mandala)
  drawRoseCurve(
    ctx, cx, cy,
    baseRadius * 0.42,          // fits inside inner ring
    valence, time, hsl, isDark,
  );

  // Layer 7: Luminous core — larger and brighter
  drawCore(ctx, cx, cy, baseRadius * 0.36, hsl, time, isDark);

  // Layer 8: Bloom overlay — additive glow for premium luminosity
  drawBloom(ctx, cx, cy, baseRadius * 0.70, hsl, time, isDark);

  // Layer 9: Soft particles
  drawParticles(ctx, particles, hsl, dpr, isDark);
}
