import { useEffect, useRef } from "react";

import { JOURNAL_CONTENT_SESSION_CHANGED_EVENT } from "@/features/journal/journalContentSession";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabaseClient";
import { reconcileAutomationRuntime, type AutomationRuntimeOptions } from "./automationRuntime";
import { AUTOMATION_SOURCE_READY_EVENT } from "./automationRuntimeSignals";

export function useAutomation(options: AutomationRuntimeOptions): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let mounted = true;
    let running = false;
    let rerunRequested = false;
    let removeNativeListener = () => undefined;

    const trigger = () => {
      if (!mounted) return;
      if (running) {
        rerunRequested = true;
        return;
      }
      running = true;
      void (async () => {
        do {
          rerunRequested = false;
          await reconcileAutomationRuntime(optionsRef.current);
        } while (mounted && rerunRequested);
      })()
        .catch(() => {
          logger.warn("[AutomationRuntime] Lifecycle reconciliation deferred");
        })
        .finally(() => {
          running = false;
          if (mounted && rerunRequested) trigger();
        });
    };

    const handleVisible = () => {
      if (document.visibilityState === "visible") trigger();
    };
    window.addEventListener("online", trigger);
    window.addEventListener(AUTOMATION_SOURCE_READY_EVENT, trigger);
    window.addEventListener(JOURNAL_CONTENT_SESSION_CHANGED_EVENT, trigger);
    document.addEventListener("visibilitychange", handleVisible);

    const authSubscription = supabase?.auth.onAuthStateChange(() => {
      trigger();
    }).data.subscription;

    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) trigger();
        });
        if (mounted) removeNativeListener = () => void handle.remove();
        else await handle.remove();
      } catch {
        logger.sync("[AutomationRuntime] Native lifecycle unavailable");
      }
    })();

    trigger();
    return () => {
      mounted = false;
      rerunRequested = false;
      window.removeEventListener("online", trigger);
      window.removeEventListener(AUTOMATION_SOURCE_READY_EVENT, trigger);
      window.removeEventListener(JOURNAL_CONTENT_SESSION_CHANGED_EVENT, trigger);
      document.removeEventListener("visibilitychange", handleVisible);
      authSubscription?.unsubscribe();
      removeNativeListener();
    };
  }, []);
}
