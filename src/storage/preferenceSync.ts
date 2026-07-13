/**
 * Cloud Preference Sync — stores UI preferences in Supabase Auth user_metadata.
 * No schema migration needed — uses auth.updateUser({ data: {...} }).
 *
 * Synced preferences: sidebar collapsed, theme, default tab.
 * Pull on login, push on change (debounced).
 */

import { supabase } from "@/lib/supabaseClient";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { logger } from "@/lib/logger";
import { useThemeStore, type ThemePreference } from "@/stores/themeStore";

interface UIPreferences {
  sidebarCollapsed?: boolean;
  theme?: "light" | "dark" | "system";
  defaultTab?: string;
}

const PREF_KEYS = {
  sidebarCollapsed: "sidebar-collapsed",
  theme: "zenflow-theme",
  defaultTab: "zenflow-default-tab",
} as const;

/**
 * Pull preferences from Supabase user_metadata and apply to localStorage.
 * Call on login / session restore.
 */
export async function pullPreferences(): Promise<void> {
  if (!supabase) return;

  try {
    const { data } = await supabase.auth.getUser();
    const prefs = data.user?.user_metadata?.ui_preferences as UIPreferences | undefined;
    if (!prefs) return;

    if (prefs.sidebarCollapsed !== undefined) {
      storageSetRaw(PREF_KEYS.sidebarCollapsed, String(prefs.sidebarCollapsed));
    }
    if (prefs.theme) {
      const canonicalTheme: ThemePreference =
        prefs.theme === "light" ? "paper" : prefs.theme === "dark" ? "ink" : "auto";
      const result = useThemeStore.getState().setTheme(canonicalTheme);
      if (!result.ok) logger.warn("[PreferenceSync] Theme preference could not be saved");
    }
    if (prefs.defaultTab) {
      storageSetRaw(PREF_KEYS.defaultTab, prefs.defaultTab);
    }

    logger.log("[PreferenceSync] Pulled preferences from cloud");
  } catch (err) {
    logger.warn("[PreferenceSync] Pull failed:", err);
  }
}

/**
 * Push current localStorage preferences to Supabase user_metadata.
 * Call on preference change (debounced).
 */
export async function pushPreferences(): Promise<void> {
  if (!supabase) return;

  try {
    const prefs: UIPreferences = {
      sidebarCollapsed: storageGetRaw(PREF_KEYS.sidebarCollapsed) === "true",
      theme: (storageGetRaw(PREF_KEYS.theme) as UIPreferences["theme"]) || "system",
      defaultTab: storageGetRaw(PREF_KEYS.defaultTab) || "home",
    };

    await supabase.auth.updateUser({
      data: { ui_preferences: prefs },
    });

    logger.log("[PreferenceSync] Pushed preferences to cloud");
  } catch (err) {
    logger.warn("[PreferenceSync] Push failed:", err);
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced push — call after any preference change.
 * Waits 2s to batch rapid changes (e.g. toggling sidebar multiple times).
 */
export function debouncedPushPreferences(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushPreferences();
    pushTimer = null;
  }, 2000);
}
