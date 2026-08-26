export function resolveHyperfocusAmbientVolume(
  masterVolume: number,
  muted: boolean,
): number {
  if (muted || !Number.isFinite(masterVolume)) return 0;
  return Math.max(0, Math.min(1, masterVolume));
}
