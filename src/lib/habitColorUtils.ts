/**
 * habitColorUtils.ts — Loop Habit Tracker 20-color palette (index-based).
 *
 * Colors are stored as palette index (0-19 integer).
 * resolveHabitColor(index, isDark) returns CSS hex string.
 * migrateColorToIndex(legacyColor) converts old hex/Tailwind strings to index.
 */

// ─── Loop-exact palettes (from PaletteUtils.kt) ─────────────────────────────

/** Light mode: Material Design 700-weight */
export const LOOP_PALETTE_LIGHT: string[] = [
  '#D32F2F', '#E64A19', '#F57C00', '#FF8F00', '#F9A825',  // Red → Yellow
  '#AFB42B', '#7CB342', '#388E3C', '#00897B', '#00ACC1',  // Lime → Cyan
  '#039BE5', '#1976D2', '#303F9F', '#5E35B1', '#8E24AA',  // Blue → Purple
  '#D81B60', '#5D4037', '#424242', '#757575', '#9E9E9E',  // Pink + Neutrals
];

/** Dark mode: Material Design 200-weight pastels */
export const LOOP_PALETTE_DARK: string[] = [
  '#EF9A9A', '#FFAB91', '#FFCC80', '#FFECB3', '#FFF59D',
  '#E6EE9C', '#C5E1A5', '#69F0AE', '#80CBC4', '#80DEEA',
  '#81D4FA', '#64B5F6', '#9FA8DA', '#B39DDB', '#CE93D8',
  '#F48FB1', '#BCAAA4', '#F5F5F5', '#E0E0E0', '#9E9E9E',
];

// ─── Color resolution ────────────────────────────────────────────────────────

/**
 * Resolve a palette index to a CSS hex color.
 * Falls back to index 8 (Teal) if out of range.
 */
export function resolveHabitColor(colorIndex: number, isDark?: boolean): string {
  const palette = isDark ? LOOP_PALETTE_DARK : LOOP_PALETTE_LIGHT;
  return palette[colorIndex] ?? palette[8];
}

// ─── Legacy migration (string → index) ──────────────────────────────────────

/** Tailwind class → hex mapping for legacy habits */
const TAILWIND_TO_HEX: Record<string, string> = {
  'bg-primary': '#8B5CF6',
  'bg-accent': '#F59E0B',
  'bg-mood-good': '#22C55E',
  'bg-mood-okay': '#3B82F6',
  'bg-mood-great': '#EC4899',
};

/** Parse hex string to RGB components */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** Euclidean distance in RGB space */
function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

/**
 * Migrate a legacy color string (hex or Tailwind class) to palette index.
 * Uses Euclidean RGB distance to find nearest match.
 */
export function migrateColorToIndex(color: string): number {
  // Direct palette match
  const directIdx = LOOP_PALETTE_LIGHT.indexOf(color);
  if (directIdx >= 0) return directIdx;

  // Resolve Tailwind → hex first
  const hex = TAILWIND_TO_HEX[color] ?? color;

  // Validate hex format
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return 8; // fallback: Teal

  const target = hexToRgb(hex);
  let bestIdx = 8;
  let bestDist = Infinity;

  for (let i = 0; i < LOOP_PALETTE_LIGHT.length; i++) {
    const dist = colorDistance(target, hexToRgb(LOOP_PALETTE_LIGHT[i]));
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return bestIdx;
}
