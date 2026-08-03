/**
 * Cloud Preference Restore — reads UI preferences from Supabase Auth user_metadata.
 *
 * Synced preferences: sidebar collapsed, theme, default tab.
 * Preferences are restored only after the authenticated and durable local owners match.
 */

import { getCurrentUserId, supabase } from "@/lib/supabaseClient";
import { storageSetRaw } from "@/lib/safeJson";
import { logger } from "@/lib/logger";
import { useThemeStore, type ThemePreference } from "@/stores/themeStore";
import { getLocalDataOwnerId } from "@/storage/db";
import { readPendingLocalBackupAccountClaim } from "@/storage/accountBoundaryRuntime";

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
async function isExactPreferenceOwner(expectedOwnerUserId: string): Promise<boolean> {
  if (readPendingLocalBackupAccountClaim().status !== "none") return false;
  const [activeUserId, localOwnerUserId] = await Promise.all([
    getCurrentUserId(),
    getLocalDataOwnerId(),
  ]);
  return (
    activeUserId === expectedOwnerUserId &&
    localOwnerUserId === expectedOwnerUserId &&
    readPendingLocalBackupAccountClaim().status === "none"
  );
}

export async function pullPreferences(expectedOwnerUserId: string): Promise<void> {
  if (!supabase) return;

  try {
    if (!(await isExactPreferenceOwner(expectedOwnerUserId))) return;
    const { data } = await supabase.auth.getUser();
    if (
      data.user?.id !== expectedOwnerUserId ||
      !(await isExactPreferenceOwner(expectedOwnerUserId))
    ) {
      return;
    }
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
