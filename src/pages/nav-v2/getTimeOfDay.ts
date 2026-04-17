/**
 * getTimeOfDay — Phase 3-A.3 A+++ WOW-2 (time-of-day cosmic palette).
 *
 * Deterministic mapping of hour-of-day to one of four palette buckets that
 * CosmicOrbBackground.css consumes via `[data-tod="…"]` selectors:
 *
 *   dawn  05–08 (pale rose + gold + soft blue — warm morning mist)
 *   day   09–16 (ivory + amber + sky blue    — bright and airy)
 *   dusk  17–20 (orange + coral + indigo     — literary sunset)
 *   night 21–04 (deep indigo + violet + cyan — cosmos dark)
 *
 * Law 19 (Clock): compute from `new Date()` only — no timezone hacks, accept
 * whatever the device clock gives us. Tests freeze time via vi.setSystemTime().
 */

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 9) return "dawn";
  if (hour >= 9 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}
