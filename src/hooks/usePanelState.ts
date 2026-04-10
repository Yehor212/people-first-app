import { useState, useEffect } from "react";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";

/**
 * Persists a numeric panel state (width, size percentage, collapsed) to localStorage.
 * Uses project-standard storageGetRaw/storageSetRaw for safe access.
 */
export function usePanelState(key: string, defaultValue: number) {
  const storageKey = `panel-${key}`;

  const [value, setValue] = useState(() => {
    const stored = storageGetRaw(storageKey);
    if (stored === null) return defaultValue;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  });

  useEffect(() => {
    storageSetRaw(storageKey, String(value));
  }, [storageKey, value]);

  return [value, setValue] as const;
}

/**
 * Persists a boolean panel state (collapsed, visible) to localStorage.
 */
export function usePanelToggle(key: string, defaultValue: boolean) {
  const storageKey = `panel-${key}`;

  const [value, setValue] = useState(() => {
    const stored = storageGetRaw(storageKey);
    if (stored === null) return defaultValue;
    return stored === "true";
  });

  useEffect(() => {
    storageSetRaw(storageKey, String(value));
  }, [storageKey, value]);

  return [value, setValue] as const;
}
