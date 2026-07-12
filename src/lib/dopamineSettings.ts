import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

export interface DopamineSettings {
  intensity: "minimal" | "normal" | "adhd";
  animations: boolean;
  sounds: boolean;
  haptics: boolean;
  confetti: boolean;
  streakFire: boolean;
  moodDrivenUI: boolean;
}

export const DEFAULT_DOPAMINE_SETTINGS: DopamineSettings = {
  intensity: "normal",
  animations: true,
  sounds: true,
  haptics: false,
  confetti: true,
  streakFire: true,
  moodDrivenUI: true,
};

function getOSPrefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function getDefaultDopamineSettings(): DopamineSettings {
  if (getOSPrefersReducedMotion()) {
    return {
      ...DEFAULT_DOPAMINE_SETTINGS,
      animations: false,
      confetti: false,
      streakFire: false,
    };
  }
  return DEFAULT_DOPAMINE_SETTINGS;
}

export function readDopamineSettings(): DopamineSettings {
  if (typeof window !== "undefined") {
    const stored = safeLocalStorageGet<DopamineSettings | null>(SK.DOPAMINE_SETTINGS, null);
    if (stored) return { ...DEFAULT_DOPAMINE_SETTINGS, ...stored };
  }
  return getDefaultDopamineSettings();
}

export function updateDopamineSettings(
  patch: Partial<DopamineSettings>,
): DopamineSettings {
  const updated = { ...readDopamineSettings(), ...patch };
  safeLocalStorageSet(SK.DOPAMINE_SETTINGS, updated);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dopamine-settings-change", { detail: updated }));
  }
  return updated;
}
