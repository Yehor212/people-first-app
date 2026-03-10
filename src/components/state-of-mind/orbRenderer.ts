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
 * 7 visual layers (back to front):
 *   1. Background Aura — diffuse glow
 *   2. Outer Shape Ring — largest, translucent, glass edges
 *   3. Middle Shape Ring — counter-rotated for depth
 *   4. Inner Shape Ring — smallest, most opaque
 *   5. Rose Curve Overlay — thin inner mandala lines
 *   6. Luminous Core — bright center with breathing pulse
 *   7. Particles — subtle floating glow dots
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

// ── Layer 1: Background Aura ──

function drawAura(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hsl: { h: number; s: number; l: number },
  time: number,
  isDark: boolean,
) {
  const baseAlpha = isDark ? 0.16 : 0.10;
  const breathAlpha = baseAlpha + Math.sin(time * 0.8) * 0.03;

  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, hsla(hsl.h, hsl.s * 0.6, hsl.l + 15, breathAlpha * 1.8));
  g.addColorStop(0.35, hsla(hsl.h, hsl.s * 0.4, hsl.l + 8, breathAlpha));
  g.addColorStop(0.7, hsla(hsl.h, hsl.s * 0.3, hsl.l, breathAlpha * 0.4));
  g.addColorStop(1, hsla(hsl.h, hsl.s * 0.2, hsl.l, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  // Drifting sub-gradient for color shimmer
  const phase = time * 0.2;
  const offsetX = noise2d(phase, 50) * radius * 0.08;
  const offsetY = noise2d(50, phase) * radius * 0.08;
  const subR = radius * 0.55;
  const subAlpha = breathAlpha * 0.4;

  const g2 = ctx.createRadialGradient(
    cx + offsetX, cy + offsetY, 0,
    cx + offsetX, cy + offsetY, subR,
  );
  g2.addColorStop(0, hsla(hsl.h + 20, hsl.s, hsl.l + 20, subAlpha));
  g2.addColorStop(1, hsla(hsl.h + 20, hsl.s, hsl.l, 0));
  ctx.fillStyle = g2;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

// ── Layers 2-4: Shape Rings ──

/**
 * Draw one concentric ring: superformula shape + gradient fill + glass-edge stroke.
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

  // Radial gradient fill
  const gradOuter = baseRadius * 1.25;
  const grad = ctx.createRadialGradient(cx, cy, baseRadius * 0.04, cx, cy, gradOuter);
  const coreLightness = isDark ? Math.min(98, hsl.l + 35) : Math.min(95, hsl.l + 28);
  grad.addColorStop(0, hsla(h, hsl.s, coreLightness, fillAlpha));
  grad.addColorStop(0.28, hsla(h, hsl.s, hsl.l + 18, fillAlpha * 0.85));
  grad.addColorStop(0.55, hsla(h, hsl.s * 0.8, hsl.l + 6, fillAlpha * 0.45));
  grad.addColorStop(1, hsla(h, hsl.s * 0.5, hsl.l, fillAlpha * 0.06));

  // Glass-edge stroke style
  const rimL = isDark ? Math.min(98, hsl.l + 42) : Math.min(96, hsl.l + 32);

  // Trace once → fill + stroke (Canvas path persists)
  traceShapePath(ctx, points);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = hsla(h, hsl.s * 0.35, rimL, edgeAlpha);
  ctx.lineWidth = baseRadius * 0.013;
  ctx.stroke();
}

// ── Layer 5: Rose Curve Overlay ──

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
  const roseAlpha = isDark ? 0.14 : 0.09;

  // Slow independent rotation
  const roseRotation = time * 0.04;

  const numPoints = 300;
  // Trace 3 full turns — enough for any rational k with small denominator
  const maxTheta = Math.PI * 6;

  ctx.beginPath();
  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * maxTheta + roseRotation;
    const r = Math.cos(k * theta) * radius;
    // Negative r naturally plots at (|r|, θ+π) via multiplication
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.strokeStyle = hsla(hsl.h, hsl.s * 0.5, Math.min(96, hsl.l + 25), roseAlpha);
  ctx.lineWidth = radius * 0.012;
  ctx.stroke();
}

// ── Layer 6: Luminous Core ──

function drawCore(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hsl: { h: number; s: number; l: number },
  time: number,
  isDark: boolean,
) {
  const breathScale = 1 + Math.sin(time * 1.2) * 0.04;
  const r = radius * breathScale;
  const coreAlpha = isDark ? 0.95 : 0.92;

  const grad = ctx.createRadialGradient(
    cx - r * 0.12, cy - r * 0.12, 0,
    cx, cy, r,
  );
  grad.addColorStop(0, hsla(hsl.h, hsl.s * 0.15, 98, coreAlpha));
  grad.addColorStop(0.18, hsla(hsl.h, hsl.s * 0.4, 93, coreAlpha * 0.9));
  grad.addColorStop(0.45, hsla(hsl.h, hsl.s * 0.7, hsl.l + 22, coreAlpha * 0.65));
  grad.addColorStop(1, hsla(hsl.h, hsl.s, hsl.l + 5, 0));

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Apple-style dark center dot (depth anchor)
  const dotR = r * 0.07;
  const dotAlpha = isDark ? 0.22 : 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
  ctx.fillStyle = hsla(hsl.h, hsl.s * 0.5, hsl.l - 15, dotAlpha);
  ctx.fill();
}

// ── Layer 7: Particles ──

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  hsl: { h: number; s: number; l: number },
  dpr: number,
  isDark: boolean,
) {
  const alphaBoost = isDark ? 0.18 : 0.04;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.alpha <= 0.01) continue;

    const px = p.x * dpr;
    const py = p.y * dpr;
    const pr = p.radius * dpr * 1.4;
    const pa = Math.min(1, p.alpha * 0.75 + alphaBoost);

    // Near-white center for premium glow
    const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    grad.addColorStop(0, hsla(hsl.h, hsl.s * 0.25, 97, pa));
    grad.addColorStop(0.35, hsla(hsl.h, hsl.s * 0.5, hsl.l + 25, pa * 0.55));
    grad.addColorStop(1, hsla(hsl.h, hsl.s, hsl.l, 0));

    ctx.fillStyle = grad;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }
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

  // Layer 1: Background aura
  drawAura(ctx, cx, cy, baseRadius * 1.65, hsl, time, isDark);

  // Layer 2: Outer shape ring (largest, most translucent, glass edges)
  drawShapeRing(
    ctx, cx, cy,
    baseRadius * 1.05, shape, time,
    time * rotSpeed,            // slow clockwise
    outerBreath,
    isDark ? 0.20 : 0.15,      // fill alpha
    isDark ? 0.38 : 0.28,      // edge alpha
    hsl, noiseAmp, noiseSpeed,
    isDark, 6, 0,               // hueShift=+6, seed=0
  );

  // Layer 3: Middle shape ring (counter-rotated for depth)
  drawShapeRing(
    ctx, cx, cy,
    baseRadius * 0.78, shape, time,
    -time * rotSpeed * 0.55,    // counter-rotation
    midBreath,
    isDark ? 0.34 : 0.28,
    isDark ? 0.42 : 0.32,
    hsl, noiseAmp * 0.7, noiseSpeed * 0.8,
    isDark, -8, 50,
  );

  // Layer 4: Inner shape ring (smallest, most opaque)
  drawShapeRing(
    ctx, cx, cy,
    baseRadius * 0.55, shape, time,
    time * rotSpeed * 0.3,      // very slow rotation
    innerBreath,
    isDark ? 0.52 : 0.48,
    isDark ? 0.48 : 0.38,
    hsl, noiseAmp * 0.5, noiseSpeed * 0.6,
    isDark, 0, 100,
  );

  // Layer 5: Rose curve overlay (thin inner mandala)
  drawRoseCurve(
    ctx, cx, cy,
    baseRadius * 0.42,          // fits inside inner ring
    valence, time, hsl, isDark,
  );

  // Layer 6: Luminous core
  drawCore(ctx, cx, cy, baseRadius * 0.28, hsl, time, isDark);

  // Layer 7: Subtle particles
  drawParticles(ctx, particles, hsl, dpr, isDark);
}
