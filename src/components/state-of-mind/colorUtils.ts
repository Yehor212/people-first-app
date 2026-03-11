/**
 * Valence → color mapping for State of Mind.
 * 5-stop HSL gradient: Purple → Indigo → Teal → Yellow → Orange.
 */

interface HSL {
  h: number;
  s: number;
  l: number;
}

/** Color stops mapped to valence values */
const COLOR_STOPS: { valence: number; color: HSL }[] = [
  { valence: -1.0, color: { h: 280, s: 60, l: 28 } },  // Deep violet — mysterious, brooding
  { valence: -0.5, color: { h: 220, s: 55, l: 45 } },  // Cool blue — distinctly different from violet
  { valence:  0.0, color: { h: 175, s: 55, l: 48 } },  // Teal-cyan — calm center
  { valence:  0.5, color: { h: 45,  s: 62, l: 50 } },  // Rich gold — warm, not neon
  { valence:  1.0, color: { h: 20,  s: 70, l: 52 } },  // Warm coral — joyful, not blinding
];

function lerpHSL(a: HSL, b: HSL, t: number): HSL {
  return {
    h: a.h + (b.h - a.h) * t,
    s: a.s + (b.s - a.s) * t,
    l: a.l + (b.l - a.l) * t,
  };
}

/**
 * Convert valence (-1.0 to 1.0) to raw HSL object.
 * Useful for Canvas gradient construction where you need numeric components.
 */
export function valenceToHSL(valence: number): HSL {
  const v = Math.max(-1, Math.min(1, valence));

  let lower = COLOR_STOPS[0];
  let upper = COLOR_STOPS[COLOR_STOPS.length - 1];

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (v >= COLOR_STOPS[i].valence && v <= COLOR_STOPS[i + 1].valence) {
      lower = COLOR_STOPS[i];
      upper = COLOR_STOPS[i + 1];
      break;
    }
  }

  const range = upper.valence - lower.valence;
  const t = range === 0 ? 0 : (v - lower.valence) / range;
  return lerpHSL(lower.color, upper.color, t);
}

/**
 * Convert valence (-1.0 to 1.0) to HSL color string.
 * @param valence - Value from -1.0 to 1.0
 * @param alpha - Optional alpha (0.0 to 1.0), returns hsla if provided
 */
export function valenceToColor(valence: number, alpha?: number): string {
  const color = valenceToHSL(valence);

  if (alpha !== undefined) {
    return `hsla(${Math.round(color.h)}, ${Math.round(color.s)}%, ${Math.round(color.l)}%, ${alpha})`;
  }
  return `hsl(${Math.round(color.h)}, ${Math.round(color.s)}%, ${Math.round(color.l)}%)`;
}

/**
 * Convert valence to RGBA string for Canvas fillStyle.
 * Uses HSL internally but outputs rgba() for contexts where HSL is inconvenient.
 */
export function valenceToRGBA(valence: number, alpha: number): string {
  return valenceToColor(valence, alpha);
}

/**
 * CSS gradient string for the full valence spectrum (left to right).
 */
export const VALENCE_GRADIENT = `linear-gradient(to right, ${COLOR_STOPS.map(
  s => `hsl(${s.color.h}, ${s.color.s}%, ${s.color.l}%)`
).join(', ')})`;

/**
 * Map valence to legacy MoodType for backward compatibility.
 * Used when saving to Supabase which has CHECK constraint on mood column.
 */
export function valenceToMoodType(valence: number): 'great' | 'good' | 'okay' | 'bad' | 'terrible' {
  if (Number.isNaN(valence)) return 'okay';
  if (valence >= 0.6) return 'great';
  if (valence >= 0.2) return 'good';
  if (valence >= -0.2) return 'okay';
  if (valence >= -0.6) return 'bad';
  return 'terrible';
}

/**
 * Map legacy MoodType to valence for migration.
 */
export function moodTypeToValence(mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible'): number {
  const map: Record<string, number> = {
    great: 1.0,
    good: 0.5,
    okay: 0.0,
    bad: -0.5,
    terrible: -1.0,
  };
  return map[mood] ?? 0;
}
