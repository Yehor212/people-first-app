/**
 * Chart typography tokens.
 *
 * SVG inline text needs numeric font-size values, so charts read the current
 * accessibility font scale in JS and pass px values directly.
 */

import { useEffect, useState } from "react";
import { safeLocalStorageGet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

/** Base axis font size in px at scale 1.0. */
const BASE_AXIS_FONT = 11;

/** Hook: returns chart font sizes scaled by --font-scale. */
export function useChartFontSizes() {
  const [scale, setScale] = useState(() => {
    if (typeof window === "undefined") return 1;
    return safeLocalStorageGet<number>(SK.FONT_SCALE, 1);
  });

  useEffect(() => {
    const handleChange = (e: CustomEvent<number>) => setScale(e.detail);
    window.addEventListener("font-scale-change", handleChange as EventListener);
    return () => window.removeEventListener("font-scale-change", handleChange as EventListener);
  }, []);

  return {
    axis: Math.round(BASE_AXIS_FONT * scale),
  };
}
