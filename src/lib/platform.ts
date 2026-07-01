/**
 * Centralized platform detection (TD-21)
 * Single source of truth — replaces scattered Capacitor.isNativePlatform() / getPlatform() calls
 */
import { Capacitor } from "@capacitor/core";
import type { AppAudioPlatform } from "@/lib/appAudioAssets";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as "android" | "ios" | "web";
export const isAndroid = platform === "android";
export const isIos = platform === "ios";
export const isWeb = platform === "web";

// Set data-platform on <html> for CSS platform branching
// Enables selectors like [data-platform="ios"] .modal { ... }
document.documentElement.dataset.platform = platform;

/** Static viewport check at load time. For reactive: use useDeviceTier() */
// Guard: on native Capacitor, window.innerWidth is 0 during early startup
export const isDesktopViewport = !isNative && window.innerWidth >= 1024;


export function getAppAudioPlatform(): AppAudioPlatform {
  if (Capacitor.isNativePlatform()) {
    const nativePlatform = Capacitor.getPlatform();
    return nativePlatform === "ios" ? "ios" : "android";
  }

  const win = window as typeof window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
    navigator?: Navigator & { standalone?: boolean };
  };
  if (win.__TAURI__ || win.__TAURI_INTERNALS__) return "desktop";
  if (win.matchMedia?.("(display-mode: standalone)").matches || win.navigator?.standalone === true) return "pwa";
  return "web";
}
