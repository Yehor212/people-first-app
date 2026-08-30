export const HYPERFOCUS_TONE_MIN_KHZ = 3;
export const HYPERFOCUS_TONE_MAX_KHZ = 16;
export const HYPERFOCUS_TONE_STEP_KHZ = 0.5;
export const HYPERFOCUS_TONE_DEFAULT_KHZ = 16;

export function normalizeHyperfocusToneKhz(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) return HYPERFOCUS_TONE_DEFAULT_KHZ;
  const clamped = Math.max(
    HYPERFOCUS_TONE_MIN_KHZ,
    Math.min(HYPERFOCUS_TONE_MAX_KHZ, parsed),
  );
  const steps = Math.round(
    (clamped - HYPERFOCUS_TONE_MIN_KHZ) / HYPERFOCUS_TONE_STEP_KHZ,
  );
  return Number(
    (
      HYPERFOCUS_TONE_MIN_KHZ +
      steps * HYPERFOCUS_TONE_STEP_KHZ
    ).toFixed(1),
  );
}

export function formatHyperfocusToneKhz(value: number): string {
  return `${normalizeHyperfocusToneKhz(value).toFixed(1).replace(/\.0$/, "")} kHz`;
}

export function toHyperfocusToneHz(value: unknown): number {
  return normalizeHyperfocusToneKhz(value) * 1000;
}
