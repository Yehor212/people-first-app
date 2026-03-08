/**
 * Blob geometry for State of Mind morphing shape.
 * SVG path generation with valence-driven jitter.
 *
 * Negative valence → spiky/jagged shape
 * Positive valence → smooth/round shape
 * Neutral → gentle wave
 */

const POINT_COUNT = 8;

/** Map a value from one range to another */
export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/**
 * Generate blob control points from valence and time.
 * Returns array of [x, y] pairs on a circle with noise.
 */
export function generateBlobPoints(
  valence: number,
  time: number,
  radius: number,
  cx: number,
  cy: number,
): [number, number][] {
  // Jitter amount: spiky at negative, smooth at positive
  const jitter = mapRange(Math.max(-1, Math.min(1, valence)), -1, 1, 0.30, 0.04);

  const points: [number, number][] = [];
  for (let i = 0; i < POINT_COUNT; i++) {
    const angle = (i / POINT_COUNT) * Math.PI * 2;
    // Multi-frequency noise for organic feel
    const noise =
      Math.sin(time * 0.8 + i * 1.7) * jitter * 0.6 +
      Math.sin(time * 1.3 + i * 2.3) * jitter * 0.4;
    const r = radius * (1 + noise);
    points.push([
      Math.cos(angle) * r + cx,
      Math.sin(angle) * r + cy,
    ]);
  }

  return points;
}

/**
 * Convert control points to smooth closed SVG path using Catmull-Rom → cubic bezier.
 */
export function smoothClosedPath(points: [number, number][]): string {
  const n = points.length;
  if (n < 3) return '';

  const parts: string[] = [];

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    // Catmull-Rom to cubic bezier control points (alpha = 0.5)
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    if (i === 0) {
      parts.push(`M ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`);
    }
    parts.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`);
  }

  parts.push('Z');
  return parts.join(' ');
}

/**
 * Generate complete blob SVG path from valence and time.
 */
export function generateBlobPath(
  valence: number,
  time: number,
  radius = 80,
  cx = 80,
  cy = 80,
): string {
  const points = generateBlobPoints(valence, time, radius, cx, cy);
  return smoothClosedPath(points);
}
