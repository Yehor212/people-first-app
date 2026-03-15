/**
 * Minimal 2D value noise for organic blob displacement.
 * No external dependencies. Zero allocations in hot path.
 *
 * Returns values in [-1, 1] for any (x, y) input.
 * Used by orbRenderer to displace control points.
 */

// Deterministic permutation table (256 entries, doubled to avoid modulo wrapping)
const PERM = new Uint8Array(512);
const GRAD = new Float32Array(512);

// Initialize permutation + gradient tables (runs once at module load)
(() => {
  // Seed-independent permutation (deterministic, well-distributed)
  const base = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
    140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
    247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
    57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
    74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
    60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
    65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
    200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
    52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
    207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
    119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
    129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
    218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
    81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
    184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
    222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
  ];

  for (let i = 0; i < 256; i++) {
    PERM[i] = PERM[i + 256] = base[i];
    // Pre-compute gradient values in [-1, 1]
    GRAD[i] = GRAD[i + 256] = (base[i] / 255) * 2 - 1;
  }
})();

/** Smoothstep interpolation: 3t² - 2t³ */
function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Turbulence noise: abs(noise) creates sharp valleys — cracked, broken surfaces.
 * Returns a value in [0, 1], remapped to [-1, 1].
 */
export function noise2dTurbulence(x: number, y: number): number {
  return Math.abs(noise2d(x, y)) * 2 - 1;
}

/**
 * Ridge noise: 1-abs(noise) creates smooth ridges — flowing, silk-like surfaces.
 * Returns a value in [0, 1], remapped to [-1, 1].
 */
export function noise2dRidge(x: number, y: number): number {
  return (1 - Math.abs(noise2d(x, y))) * 2 - 1;
}

/**
 * 2D value noise. Returns a value in [-1, 1].
 * Continuous and smooth — suitable for organic displacement.
 */
export function noise2d(x: number, y: number): number {
  // Integer cell coordinates
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;

  // Fractional position within cell
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  // Smoothstep fade curves
  const u = fade(xf);
  const v = fade(yf);

  // Hash corners
  const aa = PERM[PERM[xi] + yi];
  const ab = PERM[PERM[xi] + yi + 1];
  const ba = PERM[PERM[xi + 1] + yi];
  const bb = PERM[PERM[xi + 1] + yi + 1];

  // Bilinear interpolation of gradient values
  return lerp(
    lerp(GRAD[aa], GRAD[ba], u),
    lerp(GRAD[ab], GRAD[bb], u),
    v,
  );
}
