/**
 * Valence → color mapping for State of Mind.
 * 9-stop HSL gradient: OKLAB-interpolated between stops for perceptual uniformity.
 * Deep violet → Indigo-purple → Blue → Teal → Amber → Gold → Orange → Coral → Red.
 * 7 slider snaps map into these 9 stops via interpolation.
 */

interface HSL {
  h: number;
  s: number;
  l: number;
}

/** Color stops mapped to valence values (9-stop, orange added for warm zone richness) */
const COLOR_STOPS: { valence: number; color: HSL }[] = [
  { valence: -1.000, color: { h: 280, s: 62, l: 24 } },  // Deep violet — compact pressure
  { valence: -0.714, color: { h: 258, s: 58, l: 39 } },  // Indigo-purple — uneasy but softer
  { valence: -0.429, color: { h: 220, s: 55, l: 45 } },  // Cool blue — tension, unease
  { valence: -0.143, color: { h: 175, s: 55, l: 48 } },  // Teal-cyan — calm center (anchor)
  { valence:  0.143, color: { h: 55,  s: 58, l: 48 } },  // Warm amber — bridge teal→gold
  { valence:  0.429, color: { h: 38,  s: 65, l: 50 } },  // Rich gold — contentment
  { valence:  0.571, color: { h: 25,  s: 78, l: 52 } },  // Sunset orange — enthusiasm
  { valence:  0.714, color: { h: 16,  s: 72, l: 50 } },  // Warm coral — joy
  { valence:  1.000, color: { h: 355, s: 78, l: 48 } },  // Vivid red — passionate radiance
];

// ── OKLAB perceptually uniform color interpolation (Bjorn Ottosson) ──

interface RGB { r: number; g: number; b: number }
interface OKLab { L: number; a: number; b: number }

function hslToSrgb(hsl: HSL): RGB {
  const h = hsl.h / 360, s = hsl.s / 100, l = hsl.l / 100;
  if (s === 0) return { r: l, g: l, b: l };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    const t1 = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (t1 < 1/6) return p + (q - p) * 6 * t1;
    if (t1 < 1/2) return q;
    if (t1 < 2/3) return p + (q - p) * (2/3 - t1) * 6;
    return p;
  };
  return { r: hue2rgb(h + 1/3), g: hue2rgb(h), b: hue2rgb(h - 1/3) };
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = Math.max(0, Math.min(1, c)); // gamut clamp
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function rgbToOklab(rgb: RGB): OKLab {
  const r = srgbToLinear(rgb.r), g = srgbToLinear(rgb.g), b = srgbToLinear(rgb.b);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.7736482919 * g + 0.0144482099 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2289318233 * g + 0.6927657148 * b);
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

function oklabToRgb(lab: OKLab): RGB {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.2914855480 * lab.b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return {
    r: linearToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  };
}

function srgbToHsl(rgb: RGB): HSL {
  const r = rgb.r, g = rgb.g, b = rgb.b;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** Interpolate two HSL colors through OKLAB space for perceptual uniformity */
function lerpOklab(a: HSL, b: HSL, t: number): HSL {
  const labA = rgbToOklab(hslToSrgb(a));
  const labB = rgbToOklab(hslToSrgb(b));
  const mixed: OKLab = {
    L: labA.L + (labB.L - labA.L) * t,
    a: labA.a + (labB.a - labA.a) * t,
    b: labA.b + (labB.b - labA.b) * t,
  };
  return srgbToHsl(oklabToRgb(mixed));
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
  return lerpOklab(lower.color, upper.color, t);
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
