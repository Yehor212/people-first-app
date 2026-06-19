export const NATIVE_DIARY_DEEP_LINK_EVENT = "zenflow-native-diary-deep-link";

let nativeDiaryDeepLinkRequested = false;

export function markNativeDiaryDeepLinkRequested(): void {
  nativeDiaryDeepLinkRequested = true;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NATIVE_DIARY_DEEP_LINK_EVENT));
}

export function hasPendingNativeDiaryDeepLink(): boolean {
  return nativeDiaryDeepLinkRequested;
}

export function consumePendingNativeDiaryDeepLink(): boolean {
  const pending = nativeDiaryDeepLinkRequested;
  nativeDiaryDeepLinkRequested = false;
  return pending;
}

export function clearPendingNativeDiaryDeepLink(): void {
  nativeDiaryDeepLinkRequested = false;
}
