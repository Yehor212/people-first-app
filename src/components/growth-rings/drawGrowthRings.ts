/**
 * Pure drawing functions for GrowthRingsCanvas.
 * No React dependency — used by the canvas component.
 */

// ── Color palettes per theme ──

export const COLORS_LIGHT = {
  active: { h: 152, s: 68, l: 46 },  // emerald-500
  rest:   { h: 234, s: 56, l: 58 },  // indigo-400
  gap:    { h: 0,   s: 0,  l: 75 },  // light gray
  glow:   'rgba(16, 185, 129, ',      // emerald glow prefix
} as const;

export const COLORS_DARK = {
  active: { h: 152, s: 60, l: 65 },  // lighter emerald for dark bg
  rest:   { h: 234, s: 50, l: 72 },  // lighter indigo for dark bg
  gap:    { h: 0,   s: 0,  l: 35 },  // dark gray (contrast on dark bg)
  glow:   'rgba(52, 211, 153, ',      // emerald-400 glow prefix
} as const;

// ── Constants ──

export const MIN_RING_WIDTH = 2.5;   // px — bold readable ring width
const NOISE_POINTS = 36;             // points per organic ring path
const NOISE_AMP_1 = 0.028;           // primary noise amplitude (% of radius)
const NOISE_AMP_2 = 0.014;           // secondary noise amplitude
export const MOUNT_DURATION = 400;   // ms — reveal animation
export const AMBIENT_FRAME = 1000 / 15; // ~66ms — 15fps breathing

// ── Visual band (grouped ring data) ──

export interface VisualBand {
  type: 'active' | 'rest' | 'gap';
  density: number;
}

/**
 * Groups raw rings into visual bands that fit the canvas.
 * Zero data loss — all rings contribute via averaging.
 */
export function groupRings(rings: { type: 'active' | 'rest' | 'gap'; density: number }[], maxBands: number): VisualBand[] {
  if (rings.length === 0) return [];
  if (rings.length <= maxBands) {
    return rings.map(r => ({ type: r.type, density: r.density }));
  }

  const bands: VisualBand[] = [];
  const bandSize = rings.length / maxBands;

  for (let b = 0; b < maxBands; b++) {
    const start = Math.floor(b * bandSize);
    const end = Math.floor((b + 1) * bandSize);
    const slice = rings.slice(start, end);

    // Type = majority vote
    const counts = { active: 0, rest: 0, gap: 0 };
    let densitySum = 0;
    for (const r of slice) {
      counts[r.type]++;
      densitySum += r.density;
    }
    const type = counts.active >= counts.rest && counts.active >= counts.gap
      ? 'active'
      : counts.rest >= counts.gap ? 'rest' : 'gap';
    const density = densitySum / slice.length;

    bands.push({ type, density });
  }

  return bands;
}

/**
 * Generate noise points for an organic ring.
 * Returns array of [x, y] pairs around the center.
 */
function getNoisePoints(
  cx: number,
  cy: number,
  radius: number,
  seed: number,
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < NOISE_POINTS; i++) {
    const angle = (i / NOISE_POINTS) * Math.PI * 2;
    const noise =
      Math.sin(angle * 3 + seed) * NOISE_AMP_1 +
      Math.sin(angle * 7 + seed * 1.7) * NOISE_AMP_2;
    const r = radius * (1 + noise);
    points.push([
      cx + Math.cos(angle) * r,
      cy + Math.sin(angle) * r,
    ]);
  }
  return points;
}

/**
 * Draw a smooth organic ring using quadraticCurveTo (midpoint interpolation).
 * Each ring gets a deterministic seed for consistent shape across frames.
 */
function drawOrganicRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  seed: number,
  thickness: number,
  color: string,
) {
  const points = getNoisePoints(cx, cy, radius, seed);
  const n = points.length;
  if (n < 3) return;

  ctx.beginPath();

  // Start at midpoint between last and first point
  const startMidX = (points[n - 1][0] + points[0][0]) / 2;
  const startMidY = (points[n - 1][1] + points[0][1]) / 2;
  ctx.moveTo(startMidX, startMidY);

  // quadraticCurveTo through each noise point to the next midpoint
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const midX = (points[i][0] + points[next][0]) / 2;
    const midY = (points[i][1] + points[next][1]) / 2;
    ctx.quadraticCurveTo(points[i][0], points[i][1], midX, midY);
  }

  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.stroke();
}

/**
 * Main draw function — organic rings + center glow + outermost halo.
 * Reads dark mode live per frame (classList.contains is a hash lookup, zero layout cost).
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  bands: VisualBand[],
  size: number,
  dpr: number,
  progress: number,
  glowAlpha: number,
) {
  const w = size * dpr;
  const h = size * dpr;
  const cx = w / 2;
  const cy = h / 2;

  // Live dark mode read per frame
  const isDark = document.documentElement.classList.contains('dark');
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  ctx.clearRect(0, 0, w, h);

  const bandCount = bands.length;
  if (bandCount === 0) {
    // Empty state: subtle center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 4 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(128, 128, 128, 0.15)';
    ctx.fill();
    return;
  }

  const minRadius = 6 * dpr;
  const maxRadius = (size / 2 - 2) * dpr;
  const bandWidth = (maxRadius - minRadius) / bandCount;

  // How many bands to show based on animation progress
  const bandsToShow = Math.ceil(bandCount * progress);

  for (let i = 0; i < bandsToShow; i++) {
    const band = bands[i];
    const color = colors[band.type];
    const radius = minRadius + (i + 0.5) * bandWidth;
    const seed = i * 7 + 3; // deterministic seed per band

    // Opacity: active bold, rest medium, gap subtle
    const baseAlpha = band.type === 'gap' ? 0.18 : band.type === 'rest' ? 0.55 : 0.8;
    const alpha = baseAlpha * band.density;

    // Ring thickness — bold, min 1px at DPR scale
    const thickness = Math.max(1.0 * dpr, bandWidth * band.density * 0.85);

    const colorStr = `hsla(${color.h}, ${color.s}%, ${color.l}%, ${alpha})`;
    drawOrganicRing(ctx, cx, cy, radius, seed, thickness, colorStr);
  }

  // Glow halo on outermost ring (newest growth emphasis)
  if (bandsToShow > 0) {
    const lastBand = bands[bandsToShow - 1];
    const lastColor = colors[lastBand.type];
    const lastRadius = minRadius + (bandsToShow - 0.5) * bandWidth;
    const lastSeed = (bandsToShow - 1) * 7 + 3;
    const haloAlpha = 0.12 * glowAlpha / 0.35; // scale with breathing
    const haloThickness = bandWidth * 2.5;

    const haloColor = `hsla(${lastColor.h}, ${lastColor.s}%, ${lastColor.l}%, ${haloAlpha})`;
    drawOrganicRing(ctx, cx, cy, lastRadius, lastSeed, haloThickness, haloColor);
  }

  // Center glow — warm emerald heartwood with breathing alpha
  const glowRadius = minRadius * 1.3;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
  gradient.addColorStop(0, `${colors.glow}${glowAlpha})`);
  gradient.addColorStop(1, `${colors.glow}0)`);
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}
