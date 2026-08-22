import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { logger } from "@/lib/logger";
import { IS_DESKTOP_RUNTIME } from "@/lib/env";
import { isNative } from "@/lib/platform";
import {
  consumePwaInstallPrompt,
  getPwaInstallPromptSnapshot,
  getServerPwaInstallPromptSnapshot,
  initializePwaInstallPromptCapture,
  subscribeToPwaInstallPrompt,
} from "@/lib/pwaInstallPrompt";

export type PwaInstallKind = "installed" | "prompt" | "macos-safari-manual" | "unavailable";

function isMacOsSafari(): boolean {
  if (typeof window === "undefined") return false;
  const { maxTouchPoints, platform, userAgent, vendor } = window.navigator;
  const isIPadDesktopMode = platform === "MacIntel" && maxTouchPoints > 1;
  const isMac = /Mac/.test(platform) || /Macintosh/.test(userAgent);
  const isSafari =
    /Safari\//.test(userAgent) &&
    /Apple Computer/.test(vendor) &&
    !/(?:Chrome|Chromium|CriOS|Edg|EdgiOS|FxiOS|OPR|OPiOS)\//.test(userAgent);

  return isMac && !isIPadDesktopMode && !/(?:iPhone|iPad|iPod)/.test(userAgent) && isSafari;
}

export function usePwaInstall() {
  const browserPwaDisabled = isNative || IS_DESKTOP_RUNTIME;

  useEffect(() => {
    if (!browserPwaDisabled) initializePwaInstallPromptCapture();
  }, [browserPwaDisabled]);

  const { deferredPrompt, isInstalled } = useSyncExternalStore(
    subscribeToPwaInstallPrompt,
    getPwaInstallPromptSnapshot,
    getServerPwaInstallPromptSnapshot
  );

  const installKind = useMemo<PwaInstallKind>(() => {
    if (browserPwaDisabled) return "unavailable";
    if (isInstalled) return "installed";
    if (deferredPrompt) return "prompt";
    if (isMacOsSafari()) return "macos-safari-manual";
    return "unavailable";
  }, [browserPwaDisabled, deferredPrompt, isInstalled]);

  const promptInstall = useCallback(async () => {
    if (browserPwaDisabled) return false;
    const prompt = consumePwaInstallPrompt();
    if (!prompt) return false;

    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;

      if (outcome === "accepted") {
        return true;
      }
    } catch (error) {
      logger.error("Error prompting install:", error);
    }

    return false;
  }, [browserPwaDisabled]);

  return {
    canInstall: installKind === "prompt",
    installKind,
    isInstalled: browserPwaDisabled ? false : isInstalled,
    promptInstall,
  };
}
