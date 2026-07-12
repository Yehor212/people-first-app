import type { V2SettingsSectionId } from "./types";

const INITIAL_SECTION_TO_V2_SECTION: Record<string, V2SettingsSectionId> = {
  profile: "account",
  appearance: "appearance",
  sound: "sound",
  language: "appearance",
  notifications: "notifications",
  privacy: "privacy",
  security: "privacy",
  data: "privacy",
  account: "account",
  about: "about",
};

export function resolveInitialSettingsSection(
  initialOpenSection?: string,
): V2SettingsSectionId {
  if (!initialOpenSection) return "appearance";
  return INITIAL_SECTION_TO_V2_SECTION[initialOpenSection] || "account";
}

export function readRequestedSettingsSection(): V2SettingsSectionId | null {
  if (typeof window === "undefined") return null;

  try {
    const url = new URL(window.location.href);
    const section = url.searchParams.get("settingsSection");
    if (!section) return null;
    return INITIAL_SECTION_TO_V2_SECTION[section] || null;
  } catch {
    return null;
  }
}

export function updateSettingsSectionUrl(
  sectionId: V2SettingsSectionId | null,
  method: "pushState" | "replaceState",
): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (sectionId) url.searchParams.set("settingsSection", sectionId);
  else url.searchParams.delete("settingsSection");
  window.history[method](
    { ...window.history.state, zenflowSettingsDetail: Boolean(sectionId) },
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}
