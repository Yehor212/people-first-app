import { useEffect, useState } from "react";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { logger } from "@/lib/logger";
import { isNative } from "@/lib/platform";

/**
 * Settings ambient motion runs only while every shared accessibility,
 * performance, battery, document-visibility, and native-lifecycle gate allows it.
 */
export function useSettingsBackdropMotion(enabled = true): boolean {
  const sharedMotionAllowed = useShouldAnimate();
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document !== "undefined" && !document.hidden
  );
  const [nativeAppActive, setNativeAppActive] = useState(() => !isNative);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      setDocumentVisible(false);
      return;
    }

    const syncVisibility = () => setDocumentVisible(!document.hidden);
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setNativeAppActive(false);
      return;
    }

    if (!isNative) {
      setNativeAppActive(true);
      return;
    }

    let cancelled = false;
    let listenerAcceptsEvents = true;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        if (cancelled) return;

        let observedListenerState: boolean | null = null;
        let initialStateKnown = false;
        const handle = await App.addListener("appStateChange", ({ isActive: active }) => {
          observedListenerState = active;
          if (!cancelled && listenerAcceptsEvents && initialStateKnown) {
            setNativeAppActive(active);
          }
        });

        if (cancelled) {
          try {
            await handle.remove();
          } catch {
            logger.warn("Settings backdrop app-state listener cleanup did not complete.");
          }
          return;
        }
        listenerHandle = handle;

        // Events observed before listener registration settles can describe an
        // older lifecycle state. The explicit probe is authoritative at this
        // boundary; events arriving while it is in flight still win below.
        observedListenerState = null;
        const { isActive: currentState } = await App.getState();
        if (!cancelled) {
          initialStateKnown = true;
          setNativeAppActive(observedListenerState ?? currentState);
        }
      } catch {
        listenerAcceptsEvents = false;
        if (!cancelled) {
          setNativeAppActive(false);
          const handleToRemove = listenerHandle;
          listenerHandle = null;
          if (handleToRemove) {
            void handleToRemove.remove().catch(() => {
              logger.warn("Settings backdrop app-state listener cleanup did not complete.");
            });
          }
          logger.warn("Settings backdrop motion stayed off because app state was unavailable.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (listenerHandle) {
        void listenerHandle.remove().catch(() => {
          logger.warn("Settings backdrop app-state listener cleanup did not complete.");
        });
      }
    };
  }, [enabled]);

  return enabled && sharedMotionAllowed && documentVisible && nativeAppActive;
}
