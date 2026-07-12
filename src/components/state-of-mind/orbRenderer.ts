/**
 * Pure draw functions for the ValenceOrb canvas.
 *
 * SUPERFORMULA + ROSE CURVE architecture:
 *   r(θ) = (|cos(mθ/4)|^n2 + |sin(mθ/4)|^n3)^(-1/n1)
 *
 * Shape morphing driven by valence (-1 → +1):
 *   -1.0 → compact triangular pressure lens (heavy but soft distress)
 *   -0.5 → softer pressure lens             (uneasy pressure)
 *    0.0 → smooth centered sphere           (perfect symmetry — neutral, calm)
 *   +0.5 → gentle 5-fold bloom        (soft undulation — contentment, warmth)
 *   +1.0 → radiant 5-petal blossom    (rounded petals — joy, bliss)
 *
 * PREMIUM RENDERING PHILOSOPHY:
 *   Every shape is a luminous volumetric object, not a wireframe sketch.
 *   Rich gradient fills create depth. Multiple glow layers create bloom.
 *   Additive blending creates the illusion of emitted light.
 *
 * 17 visual layers (back to front):
 *   0. Cached Glow Layer — real shadowBlur on offscreen canvas (~0ms/frame)
 *   1. Deep Aura — wide diffuse ambient glow with drifting sub-gradients
 *  1.5. Volumetric Light Rays — god rays radiating behind orb
 *   2. Shape Glow Shadow — soft under-shape for depth
 *   3. Envelope Glow — atmospheric edge falloff (no strokes)
 *   4. Primary Solid Body — THE orb, high alpha, 3D-lit gradient fill
 *   5. Inner Luminosity — additive blending for subsurface glow
 *   6. Rose Curve Overlay — thin inner mandala lines
 *   7. Luminous Core — large bright center
 *  7.2. Inner Depth Luminance — pulsating concentric celestial glow
 *  7.4. Caustic Light Patterns — swimming refraction spots
 *  7.5. Specular Highlight — bright 3D sphere reflection spot
 *  7.6. Iridescence — thin-film rainbow shimmer at Fresnel edges
 *  7.65. Chromatic Dispersion — prismatic RGB edge fringe
 *  7.7. Rim Light — secondary light source (bottom-right)
 *  7.8. Aurora Spectral Bands — flowing multi-hue color streams
 *   8. Bloom Overlay — additive light pass for premium luminosity
 *   9. Particles — cached sprite, drawn via drawImage
 */

import { noise2d } from "./noise2d";
import { valenceToHSL } from "./colorUtils";
import type { Particle } from "./particleSystem";

// ── Cached Glow Layer (offscreen canvas with real shadowBlur) ──
// Re-rendered only when hue or radius changes significantly.
// Cost per frame: single drawImage call (~0ms).

let _glowCache: HTMLCanvasElement | null = null;
let _glowCacheKey = "";

function getOrCreateGlowCache(
  radius: number,
  hsl: { h: number; s: number; l: number },
  isDark: boolean,
): HTMLCanvasElement {
  const key = `${Math.round(radius)}_${Math.round(hsl.h)}_${isDark ? 1 : 0}`;
  if (_glowCache && _glowCacheKey === key) return _glowCache;

  const blurR = radius * 0.45;
  const padding = blurR * 2;
  const canvasSize = Math.ceil((radius + padding) * 2);

  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const cx = canvasSize / 2;
  const cy = canvasSize / 2;

  // Real Gaussian-like glow via shadowBlur (rendered once, cached)
  ctx.shadowColor = hsla(hsl.h, hsl.s * 0.7, hsl.l + 18, isDark ? 0.55 : 0.35);
  ctx.shadowBlur = blurR;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, hsla(hsl.h, hsl.s * 0.5, hsl.l + 22, 0.5));
  grad.addColorStop(0.35, hsla(hsl.h, hsl.s * 0.45, hsl.l + 14, 0.3));
  grad.addColorStop(0.65, hsla(hsl.h, hsl.s * 0.35, hsl.l + 6, 0.12));
  grad.addColorStop(1, hsla(hsl.h, hsl.s * 0.2, hsl.l, 0));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  _glowCache = canvas;
  _glowCacheKey = key;
  return canvas;
}

// ── Cached Particle Sprite (single glow dot, drawn via drawImage) ──

// ── Reusable Offscreen Canvas for soft-edge body composite ──
// Persists across frames to avoid GC churn. Resized only when needed.

let _bodyOffscreen: HTMLCanvasElement | null = null;
let _bodyOffscreenSize = 0;

function getBodyOffscreen(
  needed: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const size = Math.ceil(needed);
  if (!_bodyOffscreen || _bodyOffscreenSize < size) {
    _bodyOffscreen = document.createElement("canvas");
    _bodyOffscreen.width = size;
    _bodyOffscreen.height = size;
    _bodyOffscreenSize = size;
  }
  const ctx = _bodyOffscreen.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, _bodyOffscreen.width, _bodyOffscreen.height);
  return { canvas: _bodyOffscreen, ctx };
}

let _particleSprite: HTMLCanvasElement | null = null;
let _particleSpriteKey = "";
let _particleSpriteBlur: HTMLCanvasElement | null = null;
let _particleSpriteBlurKey = "";

function getOrCreateParticleSprites(
  hsl: { h: number; s: number; l: number },
  isDark: boolean,
): { sharp: HTMLCanvasElement; soft: HTMLCanvasElement } {
  const key = `${Math.round(hsl.h)}_${isDark ? 1 : 0}`;

  if (
    _particleSprite &&
    _particleSpriteKey === key &&
    _particleSpriteBlur &&
    _particleSpriteBlurKey === key
  ) {
    return { sharp: _particleSprite, soft: _particleSpriteBlur };
  }

  const spriteSize = 32;

  // Sharp sprite
  const sharpCanvas = document.createElement("canvas");
  sharpCanvas.width = spriteSize;
  sharpCanvas.height = spriteSize;
  const sharpCtx = sharpCanvas.getContext("2d");
  if (sharpCtx) {
    const c = spriteSize / 2;
    const r = spriteSize / 2;
    const grad = sharpCtx.createRadialGradient(c, c, 0, c, c, r);
    grad.addColorStop(0, hsla(hsl.h, hsl.s * 0.15, 98, 1.0));
    grad.addColorStop(0.18, hsla(hsl.h, hsl.s * 0.3, 93, 0.75));
    grad.addColorStop(0.45, hsla(hsl.h, hsl.s * 0.5, hsl.l + 22, 0.38));
    grad.addColorStop(1, hsla(hsl.h, hsl.s, hsl.l, 0));
    sharpCtx.fillStyle = grad;
    sharpCtx.beginPath();
    sharpCtx.arc(c, c, r, 0, Math.PI * 2);
    sharpCtx.fill();
  }

  // Soft (blurred) sprite for depth-of-field on inner particles
  const softCanvas = document.createElement("canvas");
  const softSize = spriteSize + 8; // extra padding for blur spread
  softCanvas.width = softSize;
  softCanvas.height = softSize;
  const softCtx = softCanvas.getContext("2d");
  if (softCtx) {
    if (typeof softCtx.filter === "string") {
      softCtx.filter = "blur(2px)";
      softCtx.drawImage(sharpCanvas, 4, 4); // center with 4px padding
      softCtx.filter = "none";
    } else {
      // iOS Safari < 17.2: no ctx.filter — draw with reduced alpha as soft fallback
      softCtx.globalAlpha = 0.7;
      softCtx.drawImage(sharpCanvas, 4, 4);
      softCtx.globalAlpha = 1.0;
    }
  }

  _particleSprite = sharpCanvas;
  _particleSpriteKey = key;
  _particleSpriteBlur = softCanvas;
  _particleSpriteBlurKey = key;

  return { sharp: sharpCanvas, soft: softCanvas };
}

export interface OrbSceneParams {
  valence: number;
  time: number;
  motionPhase: number;
  noisePhase: number;
  breathPhase: number;
  particles: Particle[];
  size: number;
  dpr: number;
  isDark: boolean;
  shimmer?: number; // P3: 0-1 transition burst flash
}

// ── Shape Parameters ──

interface ShapeParams {
  m: number;
  n1: number;
  n2: number;
  n3: number;
}

/**
 * Expressive preset system for superformula parameters.
 * Orb-page V2 slider snaps are seven stops (-1, -0.667, -0.333, 0, ...),
 * with a legacy -0.5 support stop for saved mood-type interop.
 * Interpolated the same way as colorUtils (lerp between adjacent stops).
 *
 * Psychology (Bouba/Kiki effect, Bar & Neta 2006):
 *   n1 < n2/n3 → pinched/spiky (threat, negative valence)
 *   n1 > n2/n3 → rounded/bloated (safety, positive valence)
 *   Negative moods keep one harmonic family so adjacent states flow instead
 *   of sweeping through accidental petal counts.
 */
const SHAPE_PRESETS: { valence: number; p: ShapeParams }[] = [
  { valence: -1.0, p: { m: 3, n1: 0.62, n2: 1.5, n3: 1.5 } }, // compact triangular pressure lens
  { valence: -0.667, p: { m: 3, n1: 1.15, n2: 1.52, n3: 1.52 } }, // bridge: same phase, release pressure
  { valence: -0.5, p: { m: 3, n1: 1.55, n2: 1.6, n3: 1.6 } }, // actual "unpleasant" stop: softer 3-lobed lens
  { valence: -0.333, p: { m: 3, n1: 1.9, n2: 1.88, n3: 1.88 } }, // near-neutral pressure, still phase-stable
  { valence: 0.0, p: { m: 5, n1: 2.0, n2: 2.0, n3: 2.0 } }, // perfect circle (m is visually irrelevant at neutral)
  { valence: 0.333, p: { m: 5, n1: 1.8, n2: 1.5, n3: 1.5 } }, // 5 gentle undulation ~8% depth
  { valence: 0.667, p: { m: 5, n1: 1.4, n2: 1.35, n3: 1.35 } }, // 5 soft petals ~14% depth
  { valence: 1.0, p: { m: 5, n1: 1.25, n2: 1.3, n3: 1.3 } }, // 5 rounded petals ~19% depth
];

function interpolateShapeM(
  valence: number,
  lower: { valence: number; p: ShapeParams },
  upper: { valence: number; p: ShapeParams },
  t: number,
): number {
  // Negative states are pressure lenses. Let n1/n2/n3 carry the emotional
  // change, but keep m phase-stable so the -1 -> -0.667 transition never
  // traverses throwaway 4/5/6-lobed forms.
  if (valence < 0 && lower.valence < 0 && upper.valence <= 0) {
    return lower.p.m;
  }

  return lower.p.m + (upper.p.m - lower.p.m) * t;
}

export function getShapeParams(valence: number): ShapeParams {
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
    m: interpolateShapeM(v, lower, upper, t),
    n1: lower.p.n1 + (upper.p.n1 - lower.p.n1) * t,
    n2: lower.p.n2 + (upper.p.n2 - lower.p.n2) * t,
    n3: lower.p.n3 + (upper.p.n3 - lower.p.n3) * t,
  };
}

function getCanvasShapeParams(valence: number): ShapeParams {
  const shape = getShapeParams(valence);
  const negativeSoftening = 0.78;
  const positiveSoftening = 0.72;
  const softening = valence < 0 ? negativeSoftening : positiveSoftening;

  return {
    m: shape.m,
    n1: 2 + (shape.n1 - 2) * softening,
    n2: 2 + (shape.n2 - 2) * softening,
    n3: 2 + (shape.n3 - 2) * softening,
  };
}

// ── Helpers ──

function mapRange(
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  const t = (v - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a.toFixed(3)})`;
}

/** GLSL-compatible smoothstep: Hermite interpolation */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function negativePressure(valence: number): number {
  return 1 - smoothstep(-1, -0.667, Math.max(-1, Math.min(1, valence)));
}

function presenceScaleForValence(valence: number): number {
  return 1 - negativePressure(valence) * 0.12;
}

export function resolveStableBreathPhase(t: number, period: number, phaseJitter = 0): number {
  if (!Number.isFinite(t) || !Number.isFinite(period) || period <= 0) return 0;
  const boundedPhase = t / period + phaseJitter;
  return ((boundedPhase % 1) + 1) % 1;
}

/**
 * Physiological breathing curve (inhale 4 → hold 1 → exhale 5 → pause 2 beats).
 * Returns 0→1→0 with natural timing. Matches WebGL shader breathCycle.
 */
function breathCycleFromPhase(rawPhase: number): number {
  const phase = ((rawPhase % 1) + 1) % 1;
  const inhale = smoothstep(0.0, 0.333, phase);
  const exhale = 1.0 - smoothstep(0.417, 0.833, phase);
  const pause = phase >= 0.833 ? 1.0 : 0.0;
  return Math.min(inhale, exhale) * (1.0 - pause);
}

// ── Superformula Core ──

/** Gielis superformula: returns radius multiplier in ~[0.1, 1.0] */
function superformula(
  theta: number,
  m: number,
  n1: number,
  n2: number,
  n3: number,
): number {
  const alpha = (m * theta) / 4;
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
  valence: number,
): [number, number][] {
  const points: [number, number][] = [];
  const mInt = Math.round(shape.m); // integer m for clean closure

  // Domain warp: barely perceptible — Apple shapes are mathematically clean
  const warpAmp = mapRange(valence, -1, 1, 0.006, 0.003);

  for (let i = 0; i < SHAPE_POINTS; i++) {
    const angle = (i / SHAPE_POINTS) * Math.PI * 2 + rotationOffset;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Domain warp: warp the angle before superformula lookup (Inigo Quilez technique)
    const warp1 = noise2d(
      cosA * 1.8 + time * noiseSpeed * 0.4 + seed,
      sinA * 1.8 + time * noiseSpeed * 0.3 + seed,
    );
    const warp2 = noise2d(
      cosA * 3.5 + time * noiseSpeed * 0.7 + seed + 50,
      sinA * 3.5 + time * noiseSpeed * 0.5 + seed + 50,
    );
    const warpedAngle =
      angle + (warp1 * 0.65 + warp2 * 0.35) * warpAmp * Math.PI * 2;

    // Superformula radius with warped angle
    const sf = superformula(warpedAngle, mInt, shape.n1, shape.n2, shape.n3);

    // 2-octave noise for organic asymmetry (domain warp adds complementary deformation)
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
function traceShapePath(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
) {
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
  // Dramatic aura — orb clearly emits light
  const baseAlpha = isDark ? 0.42 : 0.28;
  const breathAlpha = baseAlpha + Math.sin(time * 0.8) * 0.03;

  // Primary wide glow — tighter falloff
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, hsla(hsl.h, hsl.s * 0.7, hsl.l + 20, breathAlpha * 1.8));
  g.addColorStop(0.12, hsla(hsl.h, hsl.s * 0.6, hsl.l + 15, breathAlpha * 1.2));
  g.addColorStop(0.28, hsla(hsl.h, hsl.s * 0.5, hsl.l + 10, breathAlpha * 0.6));
  g.addColorStop(0.5, hsla(hsl.h, hsl.s * 0.35, hsl.l + 5, breathAlpha * 0.15));
  g.addColorStop(1, hsla(hsl.h, hsl.s * 0.2, hsl.l, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Drifting sub-gradient for color shimmer (hue offset)
  const phase = time * 0.18;
  const offsetX = noise2d(phase, 50) * radius * 0.1;
  const offsetY = noise2d(50, phase) * radius * 0.1;
  const subR = radius * 0.65;
  const subAlpha = breathAlpha * 0.55;

  const g2 = ctx.createRadialGradient(
    cx + offsetX,
    cy + offsetY,
    0,
    cx + offsetX,
    cy + offsetY,
    subR,
  );
  g2.addColorStop(0, hsla(hsl.h + 10, hsl.s * 0.9, hsl.l + 25, subAlpha));
  g2.addColorStop(
    0.4,
    hsla(hsl.h + 10, hsl.s * 0.6, hsl.l + 12, subAlpha * 0.5),
  );
  g2.addColorStop(1, hsla(hsl.h + 10, hsl.s, hsl.l, 0));
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(cx + offsetX, cy + offsetY, subR, 0, Math.PI * 2);
  ctx.fill();

  // Third sub-glow for extra vibrancy in dark mode
  if (isDark) {
    const phase2 = time * 0.14 + 3.0;
    const ox2 = noise2d(phase2 + 200, 80) * radius * 0.08;
    const oy2 = noise2d(80, phase2 + 200) * radius * 0.08;
    const g3 = ctx.createRadialGradient(
      cx + ox2,
      cy + oy2,
      0,
      cx + ox2,
      cy + oy2,
      subR * 0.8,
    );
    g3.addColorStop(
      0,
      hsla(hsl.h - 8, hsl.s * 0.7, hsl.l + 18, subAlpha * 0.4),
    );
    g3.addColorStop(1, hsla(hsl.h - 8, hsl.s * 0.4, hsl.l, 0));
    ctx.fillStyle = g3;
    ctx.beginPath();
    ctx.arc(cx + ox2, cy + oy2, subR * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Color Flow Overlay (multi-color surface — matches shader T1) ──

function drawColorFlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  h: number,
  hsl: { h: number; s: number; l: number },
  time: number,
  isDark: boolean,
) {
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = isDark ? "lighter" : "overlay";

  // Color overlay 1: hue shifted +45°, flowing position
  const hueShift1 = 45 + Math.sin(time * 0.05) * 20;
  const flowX1 = Math.sin(time * 0.06) * radius * 0.3;
  const flowY1 = Math.cos(time * 0.04) * radius * 0.3;
  const alpha1 = isDark ? 0.3 : 0.25;
  const g1 = ctx.createRadialGradient(
    cx + flowX1,
    cy + flowY1,
    0,
    cx + flowX1,
    cy + flowY1,
    radius * 0.9,
  );
  g1.addColorStop(0, hsla(h + hueShift1, hsl.s * 0.8, hsl.l + 10, alpha1));
  g1.addColorStop(0.5, hsla(h + hueShift1, hsl.s * 0.6, hsl.l, alpha1 * 0.4));
  g1.addColorStop(1, hsla(h + hueShift1, hsl.s * 0.3, hsl.l - 5, 0));
  ctx.beginPath();
  ctx.arc(cx + flowX1, cy + flowY1, radius * 0.9, 0, Math.PI * 2);
  ctx.fillStyle = g1;
  ctx.fill();

  // Color overlay 2: hue shifted -50°, different flow phase
  const hueShift2 = -(50 + Math.cos(time * 0.07) * 20);
  const flowX2 = Math.cos(time * 0.05 + 2.0) * radius * 0.25;
  const flowY2 = Math.sin(time * 0.04 + 1.5) * radius * 0.25;
  const alpha2 = isDark ? 0.25 : 0.2;
  const g2 = ctx.createRadialGradient(
    cx + flowX2,
    cy + flowY2,
    0,
    cx + flowX2,
    cy + flowY2,
    radius * 0.85,
  );
  g2.addColorStop(0, hsla(h + hueShift2, hsl.s * 0.7, hsl.l + 8, alpha2));
  g2.addColorStop(0.5, hsla(h + hueShift2, hsl.s * 0.5, hsl.l, alpha2 * 0.35));
  g2.addColorStop(1, hsla(h + hueShift2, hsl.s * 0.3, hsl.l - 5, 0));
  ctx.beginPath();
  ctx.arc(cx + flowX2, cy + flowY2, radius * 0.85, 0, Math.PI * 2);
  ctx.fillStyle = g2;
  ctx.fill();

  ctx.globalCompositeOperation = prevComposite;
}

// ── Shape Fill (volumetric blob rendering) ──

/**
 * Draw a superformula shape with rich gradient fill.
 * strokeMode: 'glow' = soft outer glow only, 'none' = fill only.
 * compositeOp: optional override (e.g. 'lighter' for inner luminosity).
 */
function drawShapeFill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  shape: ShapeParams,
  time: number,
  rotation: number,
  breathScale: number,
  fillAlpha: number,
  hsl: { h: number; s: number; l: number },
  noiseAmp: number,
  noiseSpeed: number,
  isDark: boolean,
  hueShift: number,
  seed: number,
  strokeMode: "glow" | "none" = "none",
  compositeOp?: GlobalCompositeOperation,
  valence = 0,
) {
  const h = hsl.h + hueShift;

  const points = computeShapePoints(
    cx,
    cy,
    baseRadius,
    shape,
    time,
    rotation,
    breathScale,
    noiseAmp,
    noiseSpeed,
    seed,
    valence,
  );

  const prevComposite = ctx.globalCompositeOperation;
  if (compositeOp) ctx.globalCompositeOperation = compositeOp;

  // Rich radial gradient fill — strong 3D lighting offset (top-left light source)
  const lightOffX = -baseRadius * 0.25;
  const lightOffY = -baseRadius * 0.25;
  const gradOuter = baseRadius * 1.18;
  const grad = ctx.createRadialGradient(
    cx + lightOffX,
    cy + lightOffY,
    baseRadius * 0.02,
    cx,
    cy,
    gradOuter,
  );
  // Subtle wrap lighting parity: positive valence → gentle inner warmth (+3L max)
  const wrapBoost = Math.max(0, valence) * 3;
  // Volumetric peak gradient: bright concentrated core → fast falloff → deep color → dark edge
  const coreLightness = isDark
    ? Math.min(99, hsl.l + 53)
    : Math.min(98, hsl.l + 47);
  grad.addColorStop(0, hsla(h, hsl.s * 0.1, coreLightness, fillAlpha));
  grad.addColorStop(
    0.08,
    hsla(h, hsl.s * 0.3, hsl.l + 38 + wrapBoost, fillAlpha * 0.97),
  );
  grad.addColorStop(
    0.3,
    hsla(h, hsl.s * 0.8, hsl.l + 18 + wrapBoost, fillAlpha * 0.9),
  );
  grad.addColorStop(
    0.5,
    hsla(h, hsl.s * 0.95, hsl.l + 5 + wrapBoost * 0.5, fillAlpha * 0.75),
  );
  grad.addColorStop(0.75, hsla(h, hsl.s * 0.8, hsl.l - 3, fillAlpha * 0.06));
  grad.addColorStop(0.92, hsla(h, hsl.s * 0.5, hsl.l - 10, fillAlpha * 0.02));
  grad.addColorStop(1, hsla(h, hsl.s * 0.3, hsl.l - 15, 0));

  traceShapePath(ctx, points);
  ctx.fillStyle = grad;
  ctx.fill();

  if (strokeMode === "glow") {
    // ── Glass Edge Refraction (wide bright band on body contour — Apple glass rim) ──
    // Only the primary body gets contour rings. Envelope/inner-light passes are
    // soft fills; drawing rings there stacks into a striped square artifact.
    const dpr = window.devicePixelRatio || 1;
    const ringL = isDark ? Math.min(95, hsl.l + 30) : Math.min(90, hsl.l + 15);
    traceShapePath(ctx, points);
    ctx.strokeStyle = hsla(h, hsl.s * 0.2, Math.min(97, hsl.l + 35), 0.2);
    ctx.lineWidth = 3.5 * dpr;
    ctx.stroke();
    traceShapePath(ctx, points);
    ctx.strokeStyle = hsla(h, hsl.s * 0.2, Math.min(98, hsl.l + 42), 0.65);
    ctx.lineWidth = 2.0 * dpr;
    ctx.stroke();

    // ── Inner concentric rings (2 inside body — crisp glass rim + soft glow) ──
    const innerRingScales = [0.65, 0.35];
    const innerRingAlphas = [0.34, 0.24];
    const innerRingWidths = [1.7, 1.3];
    for (let ri = 0; ri < 2; ri++) {
      const innerPts = computeShapePoints(
        cx,
        cy,
        baseRadius * innerRingScales[ri],
        shape,
        time,
        rotation,
        breathScale,
        0,
        noiseSpeed,
        seed,
        valence,
      );
      traceShapePath(ctx, innerPts);
      ctx.strokeStyle = hsla(
        h,
        hsl.s * 0.3,
        ringL + 8,
        innerRingAlphas[ri] * 0.22,
      );
      ctx.lineWidth = innerRingWidths[ri] * dpr * 2.5;
      ctx.stroke();
      traceShapePath(ctx, innerPts);
      ctx.strokeStyle = hsla(h, hsl.s * 0.4, ringL + 5, innerRingAlphas[ri]);
      ctx.lineWidth = innerRingWidths[ri] * dpr;
      ctx.stroke();
    }

    // ── Outer concentric rings (3 outside body — glass rim highlights) ──
    const ringScales = [1.14, 1.32, 1.5];
    const ringAlphas = [0.42, 0.3, 0.2];
    const ringWidths = [1.9, 1.5, 1.2];
    const ringSats = [hsl.s * 0.52, hsl.s * 0.42, hsl.s * 0.32];
    const ringLs = [ringL, ringL + 4, ringL + 8];

    for (let ri = 0; ri < 3; ri++) {
      const ringPoints = computeShapePoints(
        cx,
        cy,
        baseRadius * ringScales[ri],
        shape,
        time,
        rotation,
        breathScale,
        0,
        noiseSpeed,
        seed,
        valence,
      );
      traceShapePath(ctx, ringPoints);
      ctx.strokeStyle = hsla(
        h,
        ringSats[ri] * 0.55,
        ringLs[ri] + 5,
        ringAlphas[ri] * 0.2,
      );
      ctx.lineWidth = ringWidths[ri] * dpr * 2.4;
      ctx.stroke();
      traceShapePath(ctx, ringPoints);
      ctx.strokeStyle = hsla(h, ringSats[ri], ringLs[ri], ringAlphas[ri]);
      ctx.lineWidth = ringWidths[ri] * dpr;
      ctx.stroke();
    }

    // Optional soft glow stroke (atmospheric edge, no crisp rim)
    const glowL = isDark ? Math.min(98, hsl.l + 35) : Math.min(96, hsl.l + 28);
    ctx.strokeStyle = hsla(h, hsl.s * 0.3, glowL, isDark ? 0.22 : 0.15);
    ctx.lineWidth = baseRadius * 0.035;
    ctx.stroke();
  }

  if (compositeOp) ctx.globalCompositeOperation = prevComposite;
}

// ── Layer 6: Rose Curve Overlay ──

/**
 * Thin semi-transparent rose curve r = cos(k·θ) traced as inner mandala lines.
 * k varies with valence: complex fractions (negative) → clean integers (positive).
 */
// [DISABLED] — removed from drawOrbScene per Apple Quality pass
function _drawRoseCurve(
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
  const roseAlpha = isDark ? 0.08 : 0.05;

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

  ctx.strokeStyle = hsla(
    hsl.h,
    hsl.s * 0.4,
    Math.min(97, hsl.l + 30),
    roseAlpha,
  );
  ctx.lineWidth = radius * 0.008;
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
    cx - r * 0.15,
    cy - r * 0.15,
    0,
    cx,
    cy,
    r,
  );
  grad.addColorStop(0, hsla(hsl.h, hsl.s * 0.1, 99, coreAlpha));
  grad.addColorStop(0.1, hsla(hsl.h, hsl.s * 0.2, 97, coreAlpha * 0.95));
  grad.addColorStop(0.25, hsla(hsl.h, hsl.s * 0.45, 90, coreAlpha * 0.85));
  grad.addColorStop(
    0.45,
    hsla(hsl.h, hsl.s * 0.7, hsl.l + 25, coreAlpha * 0.6),
  );
  grad.addColorStop(
    0.7,
    hsla(hsl.h, hsl.s * 0.85, hsl.l + 12, coreAlpha * 0.25),
  );
  grad.addColorStop(1, hsla(hsl.h, hsl.s, hsl.l + 5, 0));

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Inner depth dot — subtle dark anchor for 3D feel
  const dotR = r * 0.06;
  const dotAlpha = isDark ? 0.18 : 0.1;
  ctx.beginPath();
  ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
  ctx.fillStyle = hsla(hsl.h, hsl.s * 0.5, Math.max(5, hsl.l - 20), dotAlpha);
  ctx.fill();
}

// ── Volumetric Light Rays (god rays behind orb — Canvas 2D fallback) ──

function drawGodRays(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hsl: { h: number; s: number; l: number },
  time: number,
  valence: number,
  isDark: boolean,
) {
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";

  const rayCount = 10;
  const rayRotation = time * 0.03;
  const rayLength = radius * mapRange(valence, -1, 1, 1.2, 2.0);
  // P0: foggy wide rays at negative → sharp narrow rays at positive
  const rayWidth = mapRange(valence, -1, 1, Math.PI / 10, Math.PI / 18);
  // P7: -35% volumetric rays (matches shader P5)
  const baseAlpha =
    mapRange(valence, -1, 1, 0.026, 0.078) * (isDark ? 1.2 : 1.0);

  for (let i = 0; i < rayCount; i++) {
    const angle = rayRotation + (i / rayCount) * Math.PI * 2;
    // Noise-driven per-ray flicker
    const flicker = 0.6 + noise2d(i * 7.3, time * 0.2) * 0.4;
    const alpha = baseAlpha * flicker;

    const g = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, rayLength);
    g.addColorStop(0, hsla(hsl.h, hsl.s * 0.5, hsl.l + 20, alpha));
    g.addColorStop(0.5, hsla(hsl.h, hsl.s * 0.4, hsl.l + 10, alpha * 0.4));
    g.addColorStop(1, hsla(hsl.h, hsl.s * 0.3, hsl.l, 0));

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rayLength, angle - rayWidth, angle + rayWidth);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
  }

  ctx.globalCompositeOperation = prevComposite;
}

// ── Iridescence Layer (thin-film shimmer — Canvas 2D fallback) ──

function drawIridescence(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  _hsl: { h: number; s: number; l: number },
  time: number,
  valence: number,
  isDark: boolean,
) {
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = isDark ? "lighter" : "overlay";

  // P7: Apple Intelligence-style iridescent rim (matches shader P2)
  // Uses 3 gradient bands approximating Apple's 7-color spectrum
  const alpha = mapRange(valence, -1, 1, 0.12, 0.22) * (isDark ? 1.3 : 1.0);
  const innerR = radius * 0.15; // body-wide, not rim-only
  const outerR = radius * 1.0;
  const breathShift = Math.sin(time * 0.7) * 3;
  const phase = time * 0.08; // slow animated drift (matches shader)
  const phaseHue = (phase * 60) % 360; // rotating hue offset

  // Band 1: lavender → pink (BC82F3, F5B9EA)
  const g1 = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  g1.addColorStop(0, hsla(275 + phaseHue + breathShift, 65, 73, 0));
  g1.addColorStop(0.4, hsla(275 + phaseHue + breathShift, 70, 78, alpha * 0.7));
  g1.addColorStop(0.75, hsla(320 + phaseHue + breathShift, 60, 82, alpha));
  g1.addColorStop(1, hsla(320 + phaseHue + breathShift, 50, 75, 0));

  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = g1;
  ctx.fill();

  // Band 2: blue → coral (8D9FFF, FF6778)
  const g2 = ctx.createRadialGradient(
    cx,
    cy,
    innerR * 0.9,
    cx,
    cy,
    outerR * 0.95,
  );
  g2.addColorStop(0, hsla(230 + phaseHue - breathShift, 55, 70, 0));
  g2.addColorStop(0.5, hsla(230 + phaseHue - breathShift, 65, 75, alpha * 0.5));
  g2.addColorStop(1, hsla(355 + phaseHue - breathShift, 50, 68, 0));

  ctx.beginPath();
  ctx.arc(cx, cy, outerR * 0.95, 0, Math.PI * 2);
  ctx.fillStyle = g2;
  ctx.fill();

  ctx.globalCompositeOperation = prevComposite;
}

// ── Aurora Spectral Bands (flowing color streams — Canvas 2D fallback) ──

// [DISABLED] — removed from drawOrbScene per Apple Quality pass
function _drawAuroraBands(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hsl: { h: number; s: number; l: number },
  time: number,
  valence: number,
  isDark: boolean,
) {
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "overlay";

  // P7: -20% aurora opacity, -10% drift speed (matches shader P6d)
  const alpha = mapRange(valence, -1, 1, 0.064, 0.112) * (isDark ? 1.2 : 1.0);

  // Band 1: drifting elliptical gradient (diagonal flow) — 10% slower
  const drift1x = noise2d(time * 0.072, 20) * radius * 0.3;
  const drift1y = noise2d(time * 0.054 + 50, 20) * radius * 0.3;
  const g1 = ctx.createRadialGradient(
    cx + drift1x,
    cy + drift1y,
    0,
    cx + drift1x,
    cy + drift1y,
    radius * 0.8,
  );
  g1.addColorStop(0, hsla(hsl.h + 40, hsl.s * 0.8, hsl.l + 15, alpha));
  g1.addColorStop(0.5, hsla(hsl.h + 40, hsl.s * 0.6, hsl.l + 8, alpha * 0.4));
  g1.addColorStop(1, hsla(hsl.h + 40, hsl.s * 0.4, hsl.l, 0));

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = g1;
  ctx.fill();

  // Band 2: opposite drift (vertical flow) — 10% slower
  const drift2x = noise2d(time * 0.054 + 100, 30) * radius * 0.25;
  const drift2y = noise2d(time * 0.072 + 150, 30) * radius * 0.25;
  const g2 = ctx.createRadialGradient(
    cx + drift2x,
    cy + drift2y,
    0,
    cx + drift2x,
    cy + drift2y,
    radius * 0.7,
  );
  g2.addColorStop(0, hsla(hsl.h - 30, hsl.s * 0.7, hsl.l + 12, alpha * 0.7));
  g2.addColorStop(0.5, hsla(hsl.h - 30, hsl.s * 0.5, hsl.l + 5, alpha * 0.3));
  g2.addColorStop(1, hsla(hsl.h - 30, hsl.s * 0.3, hsl.l, 0));

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = g2;
  ctx.fill();

  ctx.globalCompositeOperation = prevComposite;
}

// ── Caustic Light Patterns (swimming refraction — Canvas 2D fallback) ──

// [DISABLED] — removed from drawOrbScene per Apple Quality pass
function _drawCaustics(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hsl: { h: number; s: number; l: number },
  time: number,
  valence: number,
  isDark: boolean,
) {
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";

  const baseAlpha = mapRange(valence, -1, 1, 0.06, 0.15) * (isDark ? 1.3 : 1.0); // 4× stronger
  const causticCount = 6;
  const r = radius * 0.7;

  for (let i = 0; i < causticCount; i++) {
    const phase = (i / causticCount) * Math.PI * 2;
    const drift = time * 0.1 + phase;
    const ox = Math.sin(drift) * r * 0.3;
    const oy = Math.cos(drift * 0.8 + 1.2) * r * 0.3;
    const spotR = r * (0.2 + Math.sin(drift * 1.5 + i) * 0.1);
    const alpha = baseAlpha * (0.6 + Math.sin(drift * 2.0 + i * 1.3) * 0.4);

    const g = ctx.createRadialGradient(
      cx + ox,
      cy + oy,
      0,
      cx + ox,
      cy + oy,
      spotR,
    );
    g.addColorStop(0, hsla(hsl.h, hsl.s * 0.15, 98, alpha));
    g.addColorStop(0.4, hsla(hsl.h, hsl.s * 0.3, hsl.l + 25, alpha * 0.5));
    g.addColorStop(1, hsla(hsl.h, hsl.s * 0.2, hsl.l + 10, 0));

    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, spotR, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  ctx.globalCompositeOperation = prevComposite;
}

// ── Inner Depth Luminance (pulsating concentric glow — Canvas 2D fallback) ──

function drawInnerDepth(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hsl: { h: number; s: number; l: number },
  time: number,
  valence: number,
  isDark: boolean,
) {
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";

  // P7: softer pulse, wider zones (matches shader P6c)
  const depthPulse = Math.sin(time * 1.2) * 0.25 + 0.75; // gentler pulse
  const depthStr = mapRange(valence, -1, 1, 0.4, 1.2);

  // Zone 1: wider, softer pulsating core
  const z1R = radius * 0.4; // wider
  const z1Alpha = 0.1 * depthPulse * depthStr * (isDark ? 1.3 : 1.0); // softer
  const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, z1R);
  g1.addColorStop(0, hsla(hsl.h, hsl.s * 0.2, 99, z1Alpha));
  g1.addColorStop(0.4, hsla(hsl.h, hsl.s * 0.5, hsl.l + 30, z1Alpha * 0.6));
  g1.addColorStop(1, hsla(hsl.h, hsl.s * 0.4, hsl.l + 15, 0));

  ctx.beginPath();
  ctx.arc(cx, cy, z1R, 0, Math.PI * 2);
  ctx.fillStyle = g1;
  ctx.fill();

  // Zone 2: wider ambient glow (counter-phase)
  const z2R = radius * 0.6;
  const z2Alpha =
    0.07 * (1.0 - depthPulse * 0.3) * depthStr * (isDark ? 1.2 : 1.0);
  const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, z2R);
  g2.addColorStop(0, hsla(hsl.h, hsl.s * 0.3, hsl.l + 25, z2Alpha));
  g2.addColorStop(0.5, hsla(hsl.h, hsl.s * 0.5, hsl.l + 15, z2Alpha * 0.4));
  g2.addColorStop(1, hsla(hsl.h, hsl.s * 0.3, hsl.l + 5, 0));

  ctx.beginPath();
  ctx.arc(cx, cy, z2R, 0, Math.PI * 2);
  ctx.fillStyle = g2;
  ctx.fill();

  ctx.globalCompositeOperation = prevComposite;
}

// ── Chromatic Dispersion (prismatic edge fringe — Canvas 2D fallback) ──

// [DISABLED] — removed from drawOrbScene per Apple Quality pass
function _drawChromaticDispersion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  _hsl: { h: number; s: number; l: number },
  valence: number,
  isDark: boolean,
) {
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";

  // Prismatic fringe: red shifted outward, blue shifted inward
  const fringe = radius * mapRange(valence, -1, 1, 0.04, 0.02); // stronger at negative
  const alpha = isDark ? 0.08 : 0.05;

  // Red fringe (outer)
  const gR = ctx.createRadialGradient(
    cx,
    cy,
    radius - fringe,
    cx,
    cy,
    radius + fringe * 0.5,
  );
  gR.addColorStop(0, `rgba(0,0,0,0)`);
  gR.addColorStop(0.4, `rgba(255,120,80,${alpha})`);
  gR.addColorStop(1, `rgba(255,80,40,0)`);

  ctx.beginPath();
  ctx.arc(cx, cy, radius + fringe, 0, Math.PI * 2);
  ctx.fillStyle = gR;
  ctx.fill();

  // Blue fringe (inner)
  const gB = ctx.createRadialGradient(
    cx,
    cy,
    radius - fringe * 2,
    cx,
    cy,
    radius,
  );
  gB.addColorStop(0, `rgba(0,0,0,0)`);
  gB.addColorStop(0.5, `rgba(80,140,255,${alpha * 0.8})`);
  gB.addColorStop(1, `rgba(60,100,255,0)`);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = gB;
  ctx.fill();

  ctx.globalCompositeOperation = prevComposite;
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
  ctx.globalCompositeOperation = "lighter";

  // Dramatic bloom — visible additive glow
  const bloomAlpha = (isDark ? 0.12 : 0.07) + Math.sin(time * 0.7) * 0.01;
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

// ── Hope Sparkle (P0 — warm light within negative valence) ──

/**
 * At negative valence, rare warm amber flashes appear inside the orb.
 * "Even in the darkest state, a spark persists." — prevents negative feedback loop
 * (research: 77.8% drop-off when tracking negative emotions feels punishing).
 */
function drawHopeSparkle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  time: number,
  valence: number,
  isDark: boolean,
) {
  // Only active at negative valence
  if (valence > -0.1) return;

  const nv = (valence + 1) * 0.5; // 0 at v=-1, 0.45 at v=-0.1
  const intensity = (1 - nv) * (1 - nv); // strongest at v=-1

  // Slow flickering pulse — noise-driven for organic feel
  const pulse = Math.pow(
    Math.max(0, Math.sin(time * 0.7 + noise2d(time * 0.15, 0) * 3)),
    4,
  );
  const flicker = Math.pow(Math.max(0, noise2d(cx * 0.01, time * 0.8)), 8);
  const alpha = intensity * pulse * flicker * 0.35 * (isDark ? 1.3 : 1.0);

  if (alpha < 0.01) return;

  const sparkleR = radius * 0.35;
  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";

  // Warm amber radial glow
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sparkleR);
  g.addColorStop(0, `rgba(255, 217, 153, ${alpha})`); // warm amber center
  g.addColorStop(0.4, `rgba(255, 200, 120, ${alpha * 0.5})`);
  g.addColorStop(1, `rgba(255, 180, 80, 0)`);

  ctx.beginPath();
  ctx.arc(cx, cy, sparkleR, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.globalCompositeOperation = prevComposite;
}

// ── Specular Highlight (3D sphere illusion) ──

/**
 * Bright highlight spot offset toward the light source.
 * Creates the illusion of a reflective 3D surface — the single biggest
 * visual upgrade for perceived premium quality.
 */
function _drawSpecularHighlight(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  _hsl: { h: number; s: number; l: number },
  time: number,
  isDark: boolean,
) {
  // P7: sharper, tighter specular for glass feel (matches shader P3)
  const highlightR = radius * 0.22; // visible glass highlight
  // Light source is top-left, so highlight is offset there
  const offsetX = -radius * 0.28;
  const offsetY = -radius * 0.32;
  // Subtle breathing on the highlight
  const breathAlpha = 1 + Math.sin(time * 1.1) * 0.08;

  const alpha = (isDark ? 0.5 : 0.38) * breathAlpha; // clearly visible glass highlight

  const grad = ctx.createRadialGradient(
    cx + offsetX,
    cy + offsetY,
    0,
    cx + offsetX,
    cy + offsetY,
    highlightR,
  );
  grad.addColorStop(0, hsla(0, 0, 100, alpha)); // pure white core
  grad.addColorStop(0.15, hsla(0, 0, 99, alpha * 0.75));
  grad.addColorStop(0.4, hsla(0, 0, 95, alpha * 0.3));
  grad.addColorStop(1, hsla(0, 0, 88, 0));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx + offsetX, cy + offsetY, highlightR, 0, Math.PI * 2);
  ctx.fill();
}

// ── Rim Light (secondary light source for 3D depth) ──

/**
 * Crescent-shaped glow on the bottom-right edge.
 * Creates 2-point lighting = instant 3D depth upgrade.
 */
function drawRimLight(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hsl: { h: number; s: number; l: number },
  time: number,
  isDark: boolean,
) {
  const rimR = radius * 0.35;
  // Secondary light is bottom-right (opposite of specular)
  const offsetX = radius * 0.3;
  const offsetY = radius * 0.25;
  const breathAlpha = 1 + Math.sin(time * 0.9 + 2.0) * 0.06;
  const alpha = (isDark ? 0.14 : 0.09) * breathAlpha;

  // Warmer hue shift for secondary light (+30°)
  const rimH = hsl.h + 30;

  const grad = ctx.createRadialGradient(
    cx + offsetX,
    cy + offsetY,
    0,
    cx + offsetX,
    cy + offsetY,
    rimR,
  );
  grad.addColorStop(
    0,
    hsla(rimH, hsl.s * 0.5, Math.min(95, hsl.l + 30), alpha),
  );
  grad.addColorStop(
    0.35,
    hsla(rimH, hsl.s * 0.4, Math.min(90, hsl.l + 20), alpha * 0.55),
  );
  grad.addColorStop(1, hsla(rimH, hsl.s * 0.3, hsl.l + 10, 0));

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx + offsetX, cy + offsetY, rimR, 0, Math.PI * 2);
  ctx.fill();
}

// ── Layer 9: Particles (depth-of-field: sharp outer, soft inner) ──

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  hsl: { h: number; s: number; l: number },
  dpr: number,
  isDark: boolean,
  orbCx: number,
  orbCy: number,
  orbRadius: number,
) {
  const sprites = getOrCreateParticleSprites(hsl, isDark);
  const alphaBoost = isDark ? 0.25 : 0.1;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.alpha <= 0.01) continue;

    const px = p.x * dpr;
    const py = p.y * dpr;
    const pr = p.radius * dpr * 2.2;
    const pa = Math.min(1, p.alpha * 0.85 + alphaBoost);

    // Depth-of-field: particles closer to center use soft (blurred) sprite
    const dx = px - orbCx;
    const dy = py - orbCy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const useBlur = dist < orbRadius * 0.85;
    const sprite = useBlur ? sprites.soft : sprites.sharp;
    const spriteSize = sprite.width;

    ctx.globalAlpha = pa;
    const drawSize = pr * 2;
    ctx.drawImage(
      sprite,
      0,
      0,
      spriteSize,
      spriteSize,
      px - pr,
      py - pr,
      drawSize,
      drawSize,
    );
  }
  ctx.globalAlpha = 1;
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
  valence = 0,
) {
  const points = computeShapePoints(
    cx,
    cy,
    baseRadius * 1.08,
    shape,
    time,
    rotation,
    breathScale,
    noiseAmp * 0.6,
    noiseSpeed * 0.5,
    200,
    valence,
  );

  const shadowAlpha = 0.18;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 1.3);
  grad.addColorStop(0, hsla(hsl.h, hsl.s * 0.5, hsl.l + 15, shadowAlpha * 0.8));
  grad.addColorStop(
    0.4,
    hsla(hsl.h, hsl.s * 0.4, hsl.l + 8, shadowAlpha * 0.4),
  );
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
  const { valence, time, particles, size, dpr, isDark, shimmer = 0 } = params;
  const w = size * dpr;
  const h = size * dpr;
  const cx = w / 2;
  const cy = h / 2;

  const hsl = valenceToHSL(valence);
  const shape = getCanvasShapeParams(valence);

  ctx.clearRect(0, 0, w, h);

  // ── Valence-driven animation parameters ──
  // Apple: ~1% body variation, barely perceptible organic life
  const noiseAmp =
    0.01 + (valence < 0 ? Math.abs(valence) * 0.02 : Math.abs(valence) * 0.01);
  const noiseSpeed = mapRange(valence, -1, 1, 0.85, 0.2);
  const rotationPhase = params.motionPhase;
  const noisePhase = params.noisePhase;
  const noisePhaseTime = noiseSpeed > 0 ? noisePhase / noiseSpeed : time;

  // Subtle presence scale: lowest state contracts inward instead of adding harsh effects.
  const baseRadius = size * 0.25 * dpr * presenceScaleForValence(valence);

  // Living hue shimmer — Apple Quality: ±3° organic but stable color
  const hueShimmer = noise2d(time * 0.12, 300) * 3; // ±3° hue drift
  const shimmerHSL = { h: hsl.h + hueShimmer, s: hsl.s, l: hsl.l };

  // ── Physiological breathing (inhale→hold→exhale→pause, wave from outer to inner) ──
  const breathPeriod = mapRange(valence, -1, 1, 8.0, 16.0); // anxious=fast, calm=slow
  const breathJitter = noise2d(time * 0.03, 500) * 0.05; // bounded ±5% phase drift
  const breathPhase = Number.isFinite(params.breathPhase)
    ? params.breathPhase
    : resolveStableBreathPhase(time, breathPeriod);
  const outerBreath = 1 + breathCycleFromPhase(breathPhase + breathJitter) * 0.05 - 0.025; // ±0.025
  const bodyBreath =
    1 + breathCycleFromPhase(breathPhase - 0.8 / breathPeriod + breathJitter) * 0.04 - 0.02; // ±0.020, phase-lagged
  const innerBreath =
    1 + breathCycleFromPhase(breathPhase - 1.6 / breathPeriod + breathJitter) * 0.03 - 0.015; // ±0.015, more lagged

  // Layer 0: Cached glow layer (real shadowBlur, ~0ms per frame)
  const glowCanvas = getOrCreateGlowCache(baseRadius * 1.2, hsl, isDark);
  const glowPad = (glowCanvas.width - baseRadius * 2.4) / 2;
  ctx.drawImage(
    glowCanvas,
    cx - baseRadius * 1.2 - glowPad,
    cy - baseRadius * 1.2 - glowPad,
  );

  // Layer 1: Deep aura — wider for organic light emission into space
  drawAura(ctx, cx, cy, baseRadius * 1.45, shimmerHSL, time, isDark);

  // Layer 1.5: Volumetric light rays (god rays behind orb)
  drawGodRays(ctx, cx, cy, baseRadius, shimmerHSL, time, valence, isDark);

  // Layer 2: Shape glow shadow (depth beneath main shape)
  drawShapeShadow(
    ctx,
    cx,
    cy,
    baseRadius * 1.0,
    shape,
    noisePhaseTime,
    rotationPhase,
    outerBreath,
    shimmerHSL,
    noiseAmp,
    noiseSpeed,
    valence,
  );

  // ── Layers 3-5: Soft-edge body composite ──
  // Draw envelope + body + inner luminosity onto offscreen canvas,
  // then composite back with blur for airbrushed edge softness.
  const bodyExtent = baseRadius * 1.18 * outerBreath + 4; // max extent + blur padding
  const offscreenSize = Math.ceil(bodyExtent * 2 + 8);
  const offscreen = getBodyOffscreen(offscreenSize);

  if (offscreen) {
    const oc = offscreen.ctx;
    const ocx = offscreenSize / 2;
    const ocy = offscreenSize / 2;

    // Layer 3: Envelope glow — P7: tighter (was 1.12, now 1.06)
    drawShapeFill(
      oc,
      ocx,
      ocy,
      baseRadius * 1.06,
      shape,
      noisePhaseTime,
      rotationPhase,
      outerBreath,
      isDark ? 0.22 : 0.16,
      shimmerHSL,
      noiseAmp,
      noiseSpeed,
      isDark,
      5,
      0,
      "none",
      undefined,
      valence,
    );

    // Layer 4: Primary solid body — Apple Quality: solid core (was 0.82/0.72)
    drawShapeFill(
      oc,
      ocx,
      ocy,
      baseRadius * 1.0,
      shape,
      noisePhaseTime,
      rotationPhase,
      bodyBreath,
      isDark ? 0.92 : 0.85,
      shimmerHSL,
      noiseAmp,
      noiseSpeed,
      isDark,
      0,
      10,
      "glow",
      undefined,
      valence,
    );

    // Layer 5: Inner luminosity
    drawShapeFill(
      oc,
      ocx,
      ocy,
      baseRadius * 0.7,
      shape,
      noisePhaseTime,
      -rotationPhase * 0.4,
      innerBreath,
      isDark ? 0.18 : 0.14,
      shimmerHSL,
      noiseAmp * 0.5,
      noiseSpeed * 0.6,
      isDark,
      10,
      50,
      "none",
      "lighter",
      valence,
    );

    // Composite back with soft blur — airbrushed edges
    if (typeof ctx.filter === "string") {
      const prevFilter = ctx.filter;
      ctx.filter = "blur(1px)";
      ctx.drawImage(
        offscreen.canvas,
        0,
        0,
        offscreenSize,
        offscreenSize,
        cx - bodyExtent - 4,
        cy - bodyExtent - 4,
        offscreenSize,
        offscreenSize,
      );
      ctx.filter = prevFilter;
    } else {
      // iOS Safari < 17.2: draw without blur (sharper edges, still looks good)
      ctx.drawImage(
        offscreen.canvas,
        0,
        0,
        offscreenSize,
        offscreenSize,
        cx - bodyExtent - 4,
        cy - bodyExtent - 4,
        offscreenSize,
        offscreenSize,
      );
    }
  }

  // Layer 6: Multi-color flow overlay (matches shader T1)
  drawColorFlow(
    ctx,
    cx,
    cy,
    baseRadius,
    shimmerHSL.h,
    shimmerHSL,
    time,
    isDark,
  );

  // Layer 7: Luminous core — SHARP
  drawCore(ctx, cx, cy, baseRadius * 0.36, shimmerHSL, time, isDark);

  // Layer 7.2: Inner depth luminance — warm inner life
  drawInnerDepth(
    ctx,
    cx,
    cy,
    baseRadius * 0.85,
    shimmerHSL,
    time,
    valence,
    isDark,
  );

  // Layer 7.4: Caustics — slow swimming light for glass/crystal depth
  _drawCaustics(
    ctx,
    cx,
    cy,
    baseRadius * 0.85,
    shimmerHSL,
    time,
    valence,
    isDark,
  );

  // Layer 7.5: Specular highlight — glass material cue
  _drawSpecularHighlight(
    ctx,
    cx,
    cy,
    baseRadius * 0.85,
    shimmerHSL,
    time,
    isDark,
  );

  // Layer 7.6: Iridescence — Apple Intelligence rainbow rim (the star accent)
  drawIridescence(
    ctx,
    cx,
    cy,
    baseRadius * 0.85,
    shimmerHSL,
    time,
    valence,
    isDark,
  );

  // Layer 7.7: Rim light — secondary light source (3D depth)
  drawRimLight(ctx, cx, cy, baseRadius * 0.85, shimmerHSL, time, isDark);

  // Layer 8: Bloom overlay — additive glow for premium luminosity
  drawBloom(ctx, cx, cy, baseRadius * 0.7, shimmerHSL, time, isDark);

  // Layer 8.5: Hope sparkle — warm amber flash inside negative valence orb (P0)
  drawHopeSparkle(ctx, cx, cy, baseRadius * 0.6, time, valence, isDark);

  // Layer 8.6: Shimmer burst — P3 transition flash (desaturate + brighten)
  if (shimmer > 0.01) {
    const prevComposite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "lighter";
    const shimmerAlpha = shimmer * 0.3;
    const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 1.2);
    sg.addColorStop(0, `rgba(255, 255, 255, ${shimmerAlpha})`);
    sg.addColorStop(0.5, `rgba(255, 255, 255, ${shimmerAlpha * 0.4})`);
    sg.addColorStop(1, `rgba(255, 255, 255, 0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.globalCompositeOperation = prevComposite;
  }

  // Layer 9: Depth-of-field particles
  drawParticles(ctx, particles, shimmerHSL, dpr, isDark, cx, cy, baseRadius);

  // ── Vignette: fade to transparent at canvas edges — eliminates square artifact ──
  const vignetteR = Math.min(cx, cy);
  const vigGrad = ctx.createRadialGradient(
    cx,
    cy,
    vignetteR * 0.78,
    cx,
    cy,
    vignetteR,
  );
  vigGrad.addColorStop(0, "rgba(0,0,0,1)");
  vigGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
}
