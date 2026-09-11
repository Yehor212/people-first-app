export type DayMode = "dawn" | "morning" | "afternoon" | "golden" | "dusk";

/** Capture the existing local-time palette once for each decorative-scene visit. */
export function sampleDayPalette(activationKey: number): { activationKey: number; mode: DayMode } {
  const hour = new Date().getHours();
  const mode: DayMode =
    hour < 9 ? "dawn" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 19 ? "golden" : "dusk";
  return { activationKey, mode };
}
