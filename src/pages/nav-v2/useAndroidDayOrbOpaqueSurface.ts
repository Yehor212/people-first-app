import { useLayoutEffect } from "react";

const ANDROID_DAY_ORB_OPAQUE_SURFACE_CLASS = "android-day-orb-opaque-surface";
let androidDayOrbOpaqueSurfaceOwners = 0;

export function useAndroidDayOrbOpaqueSurface(enabled: boolean): void {
  useLayoutEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;

    androidDayOrbOpaqueSurfaceOwners += 1;
    document.body.classList.add(ANDROID_DAY_ORB_OPAQUE_SURFACE_CLASS);

    return () => {
      androidDayOrbOpaqueSurfaceOwners = Math.max(0, androidDayOrbOpaqueSurfaceOwners - 1);
      if (androidDayOrbOpaqueSurfaceOwners === 0) {
        document.body.classList.remove(ANDROID_DAY_ORB_OPAQUE_SURFACE_CLASS);
      }
    };
  }, [enabled]);
}
