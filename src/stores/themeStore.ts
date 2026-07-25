import { create } from "zustand";
import {
  safeJsonParse,
  safeJsonStringify,
  storageGetRaw,
  storageSetRaw,
} from "@/lib/safeJson";
import { logger } from "@/lib/logger";
import { isNative } from "@/lib/platform";
import { StatusBarStyle, Style } from "@/lib/statusBarStyle";
import { SK } from "@/lib/storageKeys";
import {
  DEFAULT_THEME_CUSTOMIZATION,
  applyThemeCustomizationToDOM,
  normalizeThemeCustomization,
  type AppliedTheme,
  type ThemeCustomization,
} from "./themeCustomization";

export type ThemePreference = "paper" | "ink" | "oled" | "auto";
export type { AppliedTheme } from "./themeCustomization";

export type ThemeWriteResult =
  | { ok: true; changed: boolean }
  | { ok: false; reason: "storage-unavailable" };

export interface ThemeStore {
  theme: ThemePreference;
  appliedTheme: AppliedTheme;
  themeCustomization: ThemeCustomization;
  previousThemeCustomization: ThemeCustomization | null;
  setTheme: (theme: ThemePreference) => ThemeWriteResult;
  setThemeCustomization: (customization: ThemeCustomization) => ThemeWriteResult;
  resetThemeCustomization: () => ThemeWriteResult;
  undoThemeCustomization: () => ThemeWriteResult;
  _resolve: () => void;
}

const STORAGE_KEY = "zenflow:theme-v0c";

interface PersistedThemePayload {
  state?: {
    theme?: unknown;
    themeCustomization?: unknown;
  };
  version?: unknown;
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "paper" || value === "ink" || value === "oled" || value === "auto";
}

function readPersistedThemePayload(): PersistedThemePayload | null {
  if (typeof window === "undefined") return null;
  return safeJsonParse<PersistedThemePayload | null>(storageGetRaw(STORAGE_KEY, ""), null);
}

function readInitialThemePreference(payload: PersistedThemePayload | null): ThemePreference {
  const theme = payload?.state?.theme;
  if (isThemePreference(theme)) return theme;
  if (typeof window === "undefined") return "auto";

  const legacyTheme = storageGetRaw(SK.THEME);
  const legacyOled = storageGetRaw(SK.OLED_MODE) === "true";
  if (legacyTheme === "light") return "paper";
  if (legacyTheme === "dark") return legacyOled ? "oled" : "ink";
  const legacySystemWasDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (legacyOled && legacySystemWasDark) return "oled";
  return "auto";
}

function readInitialThemeCustomization(
  payload: PersistedThemePayload | null,
): ThemeCustomization {
  return normalizeThemeCustomization(payload?.state?.themeCustomization);
}

function resolvePreference(preference: ThemePreference): AppliedTheme {
  if (preference === "paper" || preference === "ink" || preference === "oled") {
    return preference;
  }
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "paper";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "ink" : "paper";
}

function toLegacyThemePreference(theme: ThemePreference): "light" | "dark" | "system" {
  if (theme === "paper") return "light";
  if (theme === "auto") return "system";
  return "dark";
}

function applyToDOM(
  theme: ThemePreference,
  appliedTheme: AppliedTheme,
  customization: ThemeCustomization,
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const effectiveTheme = appliedTheme === "paper" ? "light" : "dark";
  root.dataset.theme = appliedTheme;
  root.classList.toggle("dark", effectiveTheme === "dark");
  root.classList.toggle("oled", appliedTheme === "oled");
  applyThemeCustomizationToDOM(appliedTheme, customization);

  if (isNative) {
    void StatusBarStyle.setStyle({
      style: effectiveTheme === "dark" ? Style.Dark : Style.Light,
    }).catch((error: unknown) => {
      logger.warn("[Theme]", "StatusBar style failed:", error);
    });
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("zenflow:theme-change", {
        detail: { theme: toLegacyThemePreference(theme), effective: effectiveTheme },
      }),
    );
  }
}

function persistThemeState(
  theme: ThemePreference,
  themeCustomization: ThemeCustomization,
): boolean {
  if (typeof window === "undefined") return true;
  const serialized = safeJsonStringify({
    state: { theme, themeCustomization },
    version: 1,
  });
  return serialized !== null && storageSetRaw(STORAGE_KEY, serialized);
}

function writeFailure(): ThemeWriteResult {
  return { ok: false, reason: "storage-unavailable" };
}

function sameCustomization(
  left: ThemeCustomization,
  right: ThemeCustomization,
): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.accentFamily === right.accentFamily &&
    left.highContrast === right.highContrast
  );
}

const initialPayload = readPersistedThemePayload();
const initialTheme = readInitialThemePreference(initialPayload);
const initialCustomization = readInitialThemeCustomization(initialPayload);
const initialAppliedTheme = resolvePreference(initialTheme);
applyToDOM(initialTheme, initialAppliedTheme, initialCustomization);

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: initialTheme,
  appliedTheme: initialAppliedTheme,
  themeCustomization: initialCustomization,
  previousThemeCustomization: null,
  setTheme: (theme) => {
    const current = get();
    if (theme === current.theme) return { ok: true, changed: false };
    if (!persistThemeState(theme, current.themeCustomization)) return writeFailure();

    const appliedTheme = resolvePreference(theme);
    storageSetRaw(SK.THEME, toLegacyThemePreference(theme));
    storageSetRaw(SK.OLED_MODE, String(theme === "oled"));
    applyToDOM(theme, appliedTheme, current.themeCustomization);
    set({ theme, appliedTheme });
    return { ok: true, changed: true };
  },
  setThemeCustomization: (customization) => {
    const next = normalizeThemeCustomization(customization);
    const current = get();
    if (sameCustomization(next, current.themeCustomization)) {
      return { ok: true, changed: false };
    }
    if (!persistThemeState(current.theme, next)) return writeFailure();

    applyToDOM(current.theme, current.appliedTheme, next);
    set({
      themeCustomization: next,
      previousThemeCustomization: current.themeCustomization,
    });
    return { ok: true, changed: true };
  },
  resetThemeCustomization: () => {
    const current = get();
    const next = { ...DEFAULT_THEME_CUSTOMIZATION };
    if (sameCustomization(next, current.themeCustomization)) {
      return { ok: true, changed: false };
    }
    if (!persistThemeState(current.theme, next)) return writeFailure();

    applyToDOM(current.theme, current.appliedTheme, next);
    set({
      themeCustomization: next,
      previousThemeCustomization: current.themeCustomization,
    });
    return { ok: true, changed: true };
  },
  undoThemeCustomization: () => {
    const current = get();
    if (!current.previousThemeCustomization) return { ok: true, changed: false };
    const next = current.previousThemeCustomization;
    if (sameCustomization(next, current.themeCustomization)) {
      return { ok: true, changed: false };
    }
    if (!persistThemeState(current.theme, next)) return writeFailure();

    applyToDOM(current.theme, current.appliedTheme, next);
    set({
      themeCustomization: next,
      previousThemeCustomization: current.themeCustomization,
    });
    return { ok: true, changed: true };
  },
  _resolve: () => {
    const current = get();
    const appliedTheme = resolvePreference(current.theme);
    applyToDOM(current.theme, appliedTheme, current.themeCustomization);
    if (appliedTheme !== current.appliedTheme) set({ appliedTheme });
  },
}));

function parseExternalPayload(raw: string | null): {
  theme: ThemePreference;
  themeCustomization: ThemeCustomization;
} | null {
  if (!raw) return null;
  const payload = safeJsonParse<PersistedThemePayload | null>(raw, null);
  const theme = payload?.state?.theme;
  if (!isThemePreference(theme)) return null;
  return {
    theme,
    themeCustomization: normalizeThemeCustomization(payload?.state?.themeCustomization),
  };
}

/**
 * Owns live System theme resolution and device-local multi-tab convergence.
 * External values are adopted directly so a storage event cannot echo another write.
 */
export function bindThemeRuntimeListeners(): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleColorScheme = () => {
    if (useThemeStore.getState().theme === "auto") useThemeStore.getState()._resolve();
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    const external = parseExternalPayload(event.newValue);
    if (!external) return;
    const appliedTheme = resolvePreference(external.theme);
    applyToDOM(external.theme, appliedTheme, external.themeCustomization);
    useThemeStore.setState({
      theme: external.theme,
      appliedTheme,
      themeCustomization: external.themeCustomization,
      previousThemeCustomization: null,
    });
  };

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", handleColorScheme);
  } else if (typeof media.addListener === "function") {
    media.addListener(handleColorScheme);
  }
  window.addEventListener("storage", handleStorage);

  return () => {
    if (typeof media.removeEventListener === "function") {
      media.removeEventListener("change", handleColorScheme);
    } else if (typeof media.removeListener === "function") {
      media.removeListener(handleColorScheme);
    }
    window.removeEventListener("storage", handleStorage);
  };
}

/** Backward-compatible bootstrap name; the implementation now includes storage convergence. */
export const bindPrefersColorSchemeListener = bindThemeRuntimeListeners;
