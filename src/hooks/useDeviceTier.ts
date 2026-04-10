import { useMemo } from "react";
import { useMediaQuery } from "./useMediaQuery";
import { isDesktopClass, supportsMultiPanel, BREAKPOINTS, type DeviceTier } from "@/lib/deviceTier";

export type { DeviceTier };

export function useDeviceTier() {
  const isTabletUp = useMediaQuery(`(min-width: ${BREAKPOINTS.tablet}px)`);
  const isLaptopUp = useMediaQuery(`(min-width: ${BREAKPOINTS.laptop}px)`);
  const isDesktopUp = useMediaQuery(`(min-width: ${BREAKPOINTS.desktop}px)`);

  const tier = useMemo<DeviceTier>(() => {
    if (isDesktopUp) return "desktop";
    if (isLaptopUp) return "laptop";
    if (isTabletUp) return "tablet";
    return "phone";
  }, [isDesktopUp, isLaptopUp, isTabletUp]);

  return useMemo(
    () => ({
      tier,
      isDesktopClass: isDesktopClass(tier),
      supportsMultiPanel: supportsMultiPanel(tier),
      breakpoints: BREAKPOINTS,
    }),
    [tier]
  );
}
