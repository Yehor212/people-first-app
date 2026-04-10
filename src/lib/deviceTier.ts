export type DeviceTier = "phone" | "tablet" | "laptop" | "desktop";

export const BREAKPOINTS = { tablet: 768, laptop: 1024, desktop: 1440 } as const;

export function calculateDeviceTier(width: number): DeviceTier {
  if (width >= BREAKPOINTS.desktop) return "desktop";
  if (width >= BREAKPOINTS.laptop) return "laptop";
  if (width >= BREAKPOINTS.tablet) return "tablet";
  return "phone";
}

export function isDesktopClass(tier: DeviceTier): boolean {
  return tier === "laptop" || tier === "desktop";
}

export function supportsMultiPanel(tier: DeviceTier): boolean {
  return tier === "laptop" || tier === "desktop";
}
