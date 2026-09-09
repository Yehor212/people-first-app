import { useLayoutEffect, type RefObject } from "react";
import { registerPlugin } from "@capacitor/core";
import { isAndroid } from "@/lib/platform";
import { logger } from "@/lib/logger";
import { observeJournalCaretVisibility } from "./journalCaretVisibility";

interface KeyboardViewportPlugin {
  acquireKeyboardViewport(): Promise<{ owner: string }>;
  releaseKeyboardViewport(options: { owner: string }): Promise<{ released: boolean }>;
}

const safeArea = registerPlugin<KeyboardViewportPlugin>("SafeArea");

/** Keep full-height native painting only while this Android editor owns the screen. */
export function useJournalKeyboardViewport(
  enabled: boolean,
  scrollAreaRef?: RefObject<HTMLDivElement>,
): void {
  useLayoutEffect(() => {
    if (!isAndroid || !enabled) return;
    let disposed = false;
    let owner: string | undefined;
    let stopCaretObservation: (() => void) | undefined;
    const release = (lease: string) => {
      void safeArea.releaseKeyboardViewport({ owner: lease }).catch(() => {
        logger.warn("[Journal] Keyboard viewport release failed");
      });
    };

    void safeArea.acquireKeyboardViewport().then(result => {
      if (disposed) release(result.owner);
      else {
        owner = result.owner;
        if (scrollAreaRef?.current) {
          stopCaretObservation = observeJournalCaretVisibility(scrollAreaRef.current, owner);
        }
      }
    }).catch(() => {
      // Older native shells keep their existing resize path; do not invent an inset.
      logger.warn("[Journal] Keyboard viewport unavailable");
    });

    return () => {
      disposed = true;
      stopCaretObservation?.();
      if (owner) release(owner);
    };
  }, [enabled, scrollAreaRef]);
}
