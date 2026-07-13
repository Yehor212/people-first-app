import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

export interface HapticsPreference {
  enabled: boolean;
}

export const DEFAULT_HAPTICS_PREFERENCE: HapticsPreference = {
  enabled: false,
};

export const HAPTICS_PREFERENCE_CHANGE_EVENT = "zenflow-haptics-preference-change";

function normalizeHapticsPreference(value: unknown): HapticsPreference {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_HAPTICS_PREFERENCE;
  }
  const candidate = value as Partial<HapticsPreference>;
  return {
    enabled:
      typeof candidate.enabled === "boolean"
        ? candidate.enabled
        : DEFAULT_HAPTICS_PREFERENCE.enabled,
  };
}

export function getHapticsPreference(): HapticsPreference {
  return normalizeHapticsPreference(
    safeLocalStorageGet<unknown>(SK.HAPTICS_ENABLED, DEFAULT_HAPTICS_PREFERENCE),
  );
}

export type HapticsPreferenceWriteResult =
  | { ok: true; preference: HapticsPreference }
  | { ok: false; preference: HapticsPreference };

export function trySetHapticsEnabled(enabled: boolean): HapticsPreferenceWriteResult {
  const current = getHapticsPreference();
  const next = { enabled };
  if (!safeLocalStorageSet(SK.HAPTICS_ENABLED, next)) {
    return { ok: false, preference: current };
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<HapticsPreference>(HAPTICS_PREFERENCE_CHANGE_EVENT, {
        detail: next,
      }),
    );
  }
  return { ok: true, preference: next };
}

export function subscribeHapticsPreference(
  listener: (preference: HapticsPreference) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handleChange = (event: Event) => {
    if (event instanceof CustomEvent) {
      listener(normalizeHapticsPreference(event.detail));
    }
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SK.HAPTICS_ENABLED || event.key === null) {
      listener(getHapticsPreference());
    }
  };

  window.addEventListener(HAPTICS_PREFERENCE_CHANGE_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(HAPTICS_PREFERENCE_CHANGE_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}
