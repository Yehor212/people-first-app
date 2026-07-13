import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

export interface MotionPreference {
  reduceMotion: boolean;
}

export const DEFAULT_MOTION_PREFERENCE: MotionPreference = {
  reduceMotion: false,
};

export const MOTION_PREFERENCE_CHANGE_EVENT = "zenflow-motion-preference-change";

function normalizeMotionPreference(value: unknown): MotionPreference {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_MOTION_PREFERENCE;
  }
  const candidate = value as Partial<MotionPreference>;
  return {
    reduceMotion:
      typeof candidate.reduceMotion === "boolean"
        ? candidate.reduceMotion
        : DEFAULT_MOTION_PREFERENCE.reduceMotion,
  };
}

export function getMotionPreference(): MotionPreference {
  return normalizeMotionPreference(
    safeLocalStorageGet<unknown>(SK.REDUCE_MOTION, DEFAULT_MOTION_PREFERENCE),
  );
}

export type MotionPreferenceWriteResult =
  | { ok: true; preference: MotionPreference }
  | { ok: false; preference: MotionPreference };

export function trySetReduceMotion(reduceMotion: boolean): MotionPreferenceWriteResult {
  const current = getMotionPreference();
  const next = { reduceMotion };
  if (!safeLocalStorageSet(SK.REDUCE_MOTION, next)) {
    return { ok: false, preference: current };
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<MotionPreference>(MOTION_PREFERENCE_CHANGE_EVENT, {
        detail: next,
      }),
    );
  }
  return { ok: true, preference: next };
}

export function subscribeMotionPreference(
  listener: (preference: MotionPreference) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handleChange = (event: Event) => {
    if (event instanceof CustomEvent) {
      listener(normalizeMotionPreference(event.detail));
    }
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SK.REDUCE_MOTION || event.key === null) {
      listener(getMotionPreference());
    }
  };

  window.addEventListener(MOTION_PREFERENCE_CHANGE_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(MOTION_PREFERENCE_CHANGE_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}
