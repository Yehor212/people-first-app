/**
 * Chart typography and color tokens.
 *
 * IMPORTANT: Recharts renders SVG inline attributes, NOT CSS stylesheets.
 * CSS var() does NOT work in SVG inline fontSize/fill attributes.
 * Solution: read computed CSS values in JS and pass as numeric props.
 */

import { useState, useEffect } from "react";
import { safeLocalStorageGet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

/** Base font sizes in px (at scale 1.0) */
const BASE_FONT = {
  axis: 11,
  tooltip: 13,
  label: 15,
  title: 17,
} as const;

/**
 * Hook: returns chart font sizes scaled by --font-scale.
 * Recharts needs numeric px values — CSS var() doesn't work in SVG attributes.
 */
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
    axis: Math.round(BASE_FONT.axis * scale),
    tooltip: Math.round(BASE_FONT.tooltip * scale),
    label: Math.round(BASE_FONT.label * scale),
    title: Math.round(BASE_FONT.title * scale),
  };
}

/** Chart colors — reference theme tokens for dark mode support */
export const CHART_COLORS = {
  moodGreat: "hsl(var(--mood-great))",
  moodGood: "hsl(var(--mood-good))",
  moodOkay: "hsl(var(--mood-okay))",
  moodBad: "hsl(var(--mood-bad))",
  moodTerrible: "hsl(var(--mood-terrible))",
  primary: "hsl(var(--primary))",
  muted: "hsl(var(--muted-foreground))",
  border: "hsl(var(--border))",
  foreground: "hsl(var(--foreground))",
} as const;

/** Chart dimensions — responsive via container queries */
export const CHART_MARGIN = { top: 5, right: 5, bottom: 5, left: 5 } as const;
