/**
 * Pure draw functions for the ValenceOrb canvas.
 * Stateless — receives context + parameters, returns nothing.
 *
 * 4 visual layers (back to front):
 *   1. Outer Aura — diffuse glow with drifting offset sub-gradients
 *   2. Middle Blob — organic shape via 2D noise, the main visual
 *   3. Inner Core — bright concentrated center with subtle pulse
 *   4. Particles — floating glow dots around the orb
 *
 * Follows GrowthRingsCanvas drawScene() pattern.
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

// ── Helpers ──

/** Map value from one range to another */
function mapRange(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = (v - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

/** Build hsla() string from HSL object + alpha */
function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a.toFixed(3)})`;
}

// ── Layer 1: Outer Aura ──

function drawOuterAura(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hsl: { h: number; s: number; l: number },
  time: number,
  isDark: boolean,
) {
  const baseAlpha = isDark ? 0.18 : 0.13;
  const breathAlpha = baseAlpha + Math.sin(time * 0.8) * 0.05;

  // Main centered aura
  const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g1.addColorStop(0, hsla(hsl.h, hsl.s, hsl.l + 10, breathAlpha));
  g1.addColorStop(0.6, hsla(hsl.h, hsl.s, hsl.l, breathAlpha * 0.5));
  g1.addColorStop(1, hsla(hsl.h, hsl.s, hsl.l, 0));
  ctx.fillStyle = g1;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  // 2 offset sub-gradients for "inner light spill"
  for (let i = 0; i < 2; i++) {
    const offsetX = noise2d(time * 0.3 + i * 50, i * 100) * radius * 0.08;
    const offsetY = noise2d(i * 50, time * 0.3 + i * 100) * radius * 0.08;
    const subR = radius * 0.7;
    const subAlpha = breathAlpha * 0.4;

    const g = ctx.createRadialGradient(
      cx + offsetX, cy + offsetY, 0,
      cx + offsetX, cy + offsetY, subR,
    );
    g.addColorStop(0, hsla(hsl.h + (i === 0 ? 10 : -10), hsl.s, hsl.l + 15, subAlpha));
    g.addColorStop(1, hsla(hsl.h, hsl.s, hsl.l, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }
}

// ── Layer 2: Middle Organic Blob ──

const BLOB_POINTS = 12;

function drawMiddleBlob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  valence: number,
  time: number,
  hsl: { h: number; s: number; l: number },
  isDark: boolean,
) {
  // Valence-driven noise parameters
  const noiseAmp = mapRange(valence, -1, 1, 0.25, 0.05);
  const noiseSpeed = mapRange(valence, -1, 1, 1.5, 0.4);
  const noiseFreq1 = 2.5;
  const noiseFreq2 = 5.0;

  // Generate displaced points
  const points: [number, number][] = [];
  for (let i = 0; i < BLOB_POINTS; i++) {
    const angle = (i / BLOB_POINTS) * Math.PI * 2;

    // Two octaves of noise for organic feel
    const n1 = noise2d(
      Math.cos(angle) * noiseFreq1 + time * noiseSpeed,
      Math.sin(angle) * noiseFreq1 + time * noiseSpeed * 0.7,
    );
    const n2 = noise2d(
      Math.cos(angle) * noiseFreq2 + time * noiseSpeed * 1.3 + 100,
      Math.sin(angle) * noiseFreq2 + time * noiseSpeed * 0.9 + 100,
    );

    const displacement = 1 + (n1 * 0.7 + n2 * 0.3) * noiseAmp;
    const r = radius * displacement;

    points.push([
      cx + Math.cos(angle) * r,
      cy + Math.sin(angle) * r,
    ]);
  }

  // Draw smooth closed path via quadraticCurveTo midpoint interpolation
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

  // Radial gradient fill
  const centerAlpha = isDark ? 0.85 : 0.80;
  const edgeAlpha = isDark ? 0.45 : 0.40;

  const grad = ctx.createRadialGradient(
    cx - radius * 0.15, cy - radius * 0.15, 0,
    cx, cy, radius,
  );
  grad.addColorStop(0, hsla(hsl.h, hsl.s, Math.min(95, hsl.l + 25), centerAlpha));
  grad.addColorStop(0.5, hsla(hsl.h, hsl.s, hsl.l + 5, (centerAlpha + edgeAlpha) / 2));
  grad.addColorStop(1, hsla(hsl.h, hsl.s, hsl.l, edgeAlpha));

  ctx.fillStyle = grad;
  ctx.fill();
}

// ── Layer 3: Inner Core ──

function drawInnerCore(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  hsl: { h: number; s: number; l: number },
  time: number,
  isDark: boolean,
) {
  // Breathing pulse
  const breathScale = 1 + Math.sin(time * 1.2) * 0.03;
  const r = radius * breathScale;

  const coreAlpha = isDark ? 0.95 : 0.9;

  const grad = ctx.createRadialGradient(
    cx - r * 0.2, cy - r * 0.2, 0,
    cx, cy, r,
  );
  grad.addColorStop(0, hsla(hsl.h, hsl.s * 0.3, 97, coreAlpha));
  grad.addColorStop(0.4, hsla(hsl.h, hsl.s, hsl.l + 20, coreAlpha * 0.8));
  grad.addColorStop(1, hsla(hsl.h, hsl.s, hsl.l + 5, 0));

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
}

// ── Layer 4: Particles ──

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  hsl: { h: number; s: number; l: number },
  dpr: number,
  isDark: boolean,
) {
  const alphaBoost = isDark ? 0.15 : 0;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.alpha <= 0.01) continue;

    const px = p.x * dpr;
    const py = p.y * dpr;
    const pr = p.radius * dpr;
    const pa = Math.min(1, p.alpha * 0.7 + alphaBoost);

    const particleH = hsl.h + p.hueOffset;

    // Soft glow via radial gradient
    const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    grad.addColorStop(0, hsla(particleH, hsl.s, hsl.l + 20, pa));
    grad.addColorStop(0.5, hsla(particleH, hsl.s, hsl.l + 10, pa * 0.5));
    grad.addColorStop(1, hsla(particleH, hsl.s, hsl.l, 0));

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

  ctx.clearRect(0, 0, w, h);

  // Layer 1: Outer aura (back-most)
  const auraRadius = (size * 0.45) * dpr;
  drawOuterAura(ctx, cx, cy, auraRadius, hsl, time, isDark);

  // Layer 2: Middle organic blob
  const blobRadius = (size * 0.32) * dpr;
  drawMiddleBlob(ctx, cx, cy, blobRadius, valence, time, hsl, isDark);

  // Layer 3: Inner core (front highlight)
  const coreRadius = (size * 0.18) * dpr;
  drawInnerCore(ctx, cx, cy, coreRadius, hsl, time, isDark);

  // Layer 4: Particles (topmost)
  drawParticles(ctx, particles, hsl, dpr, isDark);
}
