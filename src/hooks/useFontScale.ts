import { useState, useEffect, useCallback } from "react";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

/** Valid font scale levels (Telegram-style in-app control) */
export const FONT_SCALE_LEVELS = [0.85, 0.9, 1.0, 1.1, 1.2, 1.3, 1.5] as const;
export type FontScaleLevel = (typeof FONT_SCALE_LEVELS)[number];

const FONT_SCALE_EVENT = "font-scale-change";
const DEFAULT_SCALE: FontScaleLevel = 1.0;

/** Apply --font-scale CSS custom property to document root */
function applyFontScale(scale: number): void {
  document.documentElement.style.setProperty("--font-scale", String(scale));
}

/**
 * Hook for managing in-app font scale (Telegram-style slider).
 * Uses localStorage + custom event pattern (same as DopamineSettings).
 * Applies --font-scale CSS custom property on :root for calc() multiplier.
 */
export function useFontScale() {
  const [scale, setScale] = useState<FontScaleLevel>(() => {
    if (typeof window === "undefined") return DEFAULT_SCALE;
    const stored = safeLocalStorageGet<number>(SK.FONT_SCALE, DEFAULT_SCALE);
    const validated = FONT_SCALE_LEVELS.includes(stored as FontScaleLevel)
      ? (stored as FontScaleLevel)
      : DEFAULT_SCALE;
    applyFontScale(validated);
    return validated;
  });

  const setFontScale = useCallback((newScale: FontScaleLevel) => {
    setScale(newScale);
    safeLocalStorageSet(SK.FONT_SCALE, newScale);
    applyFontScale(newScale);
    window.dispatchEvent(new CustomEvent(FONT_SCALE_EVENT, { detail: newScale }));
  }, []);

  useEffect(() => {
    // Cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SK.FONT_SCALE && e.newValue) {
        const parsed = JSON.parse(e.newValue) as number;
        if (FONT_SCALE_LEVELS.includes(parsed as FontScaleLevel)) {
          setScale(parsed as FontScaleLevel);
          applyFontScale(parsed);
        }
      }
    };

    // Same-tab sync
    const handleCustom = (e: CustomEvent<FontScaleLevel>) => {
      setScale(e.detail);
      applyFontScale(e.detail);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(FONT_SCALE_EVENT, handleCustom as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(FONT_SCALE_EVENT, handleCustom as EventListener);
    };
  }, []);

  return { scale, setFontScale, levels: FONT_SCALE_LEVELS } as const;
}

/** Read-only hook — just applies the stored font scale on mount */
export function useFontScaleInit(): void {
  useEffect(() => {
    const stored = safeLocalStorageGet<number>(SK.FONT_SCALE, DEFAULT_SCALE);
    const validated = FONT_SCALE_LEVELS.includes(stored as FontScaleLevel) ? stored : DEFAULT_SCALE;
    applyFontScale(validated);
  }, []);
}
