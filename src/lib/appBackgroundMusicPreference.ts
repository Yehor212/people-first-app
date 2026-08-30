import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

export const APP_BACKGROUND_MUSIC_PREFERENCE_CHANGE_EVENT =
  "zenflow-app-background-music-preference-change";

export function getAppBackgroundMusicEnabled(): boolean {
  return safeLocalStorageGet<unknown>(SK.APP_BACKGROUND_MUSIC_ENABLED, false) === true;
}

export function trySetAppBackgroundMusicEnabled(
  enabled: boolean,
): { ok: boolean; enabled: boolean } {
  const previous = getAppBackgroundMusicEnabled();
  if (enabled === previous) return { ok: true, enabled: previous };
  if (!safeLocalStorageSet(SK.APP_BACKGROUND_MUSIC_ENABLED, enabled)) {
    return { ok: false, enabled: previous };
  }
  window.dispatchEvent(
    new CustomEvent<boolean>(APP_BACKGROUND_MUSIC_PREFERENCE_CHANGE_EVENT, {
      detail: enabled,
    }),
  );
  return { ok: true, enabled };
}

export function subscribeAppBackgroundMusicPreference(
  listener: (enabled: boolean) => void,
): () => void {
  const handlePreference = (event: Event) => {
    if (event instanceof CustomEvent && typeof event.detail === "boolean") {
      listener(event.detail);
    }
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SK.APP_BACKGROUND_MUSIC_ENABLED) {
      listener(getAppBackgroundMusicEnabled());
    }
  };
  window.addEventListener(APP_BACKGROUND_MUSIC_PREFERENCE_CHANGE_EVENT, handlePreference);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(APP_BACKGROUND_MUSIC_PREFERENCE_CHANGE_EVENT, handlePreference);
    window.removeEventListener("storage", handleStorage);
  };
}
