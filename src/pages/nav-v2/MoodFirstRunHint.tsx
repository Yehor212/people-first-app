import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { haptics } from "@/lib/haptics";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { isAndroid } from "@/lib/platform";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import "./MoodFirstRunHint.css";

/**
 * MoodFirstRunHint — Phase 3-A.4b one-time onboarding nudge.
 *
 * Shows three beats:
 *   1. Move the mood slider
 *   2. Choose a scope
 *   3. Optionally add details, then start the journal entry
 *
 * Appears only on first visit with zero prior mood entries. Dismissed forever
 * via a localStorage flag (`zenflow-orb-first-run-dismissed`). Survives
 * remount/refresh — does NOT re-render once user dismisses.
 *
 * Non-modal by design: the hint explains the first mood entry without blocking
 * V2 navigation. Escape and the explicit button still dismiss it.
 */

const STORAGE_KEY = SK.ORB_FIRST_RUN_DISMISSED;

function readDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return storageGetRaw(STORAGE_KEY, "0") === "1";
}

function writeDismissed(): void {
  if (typeof window === "undefined") return;
  storageSetRaw(STORAGE_KEY, "1");
}

export interface MoodFirstRunHintProps {
  /** Must be true for the hint to be shown (parent gates on moods.length === 0). */
  eligible: boolean;
}

export const MoodFirstRunHint = memo(function MoodFirstRunHint({
  eligible,
}: MoodFirstRunHintProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const [visible, setVisible] = useState(false);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback(() => {
    void haptics.tabChanged();
    setVisible(false);
    writeDismissed();
  }, []);

  useEffect(() => {
    if (!eligible) return;
    if (readDismissed()) return;
    setVisible(true);
  }, [eligible]);

  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setVisible(false);
        writeDismissed();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  useEffect(() => {
    if (!visible || !isAndroid) return;
    return registerModalCloseCallback(() => {
      dismiss();
      return true;
    });
  }, [dismiss, visible]);

  useEffect(() => {
    if (!visible || !isAndroid) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => dismissButtonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      previousFocus?.focus();
    };
  }, [visible]);

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <section
      aria-labelledby="mood-first-run-title"
      data-testid="mood-first-run-hint"
      className="mood-first-run-backdrop"
    >
      <div className="mood-first-run-card">
        <h2
          id="mood-first-run-title"
          className="mood-first-run-title"
        >
          {tx.orbFirstRunTitle || "Three steps to your first entry"}
        </h2>

        <ol className="mood-first-run-steps">
          <li className="mood-first-run-step">
            <span className="mood-first-run-step-index">1</span>
            <span className="mood-first-run-step-text">
              {tx.orbFirstRunStep1 || "Move the slider to match how you feel"}
            </span>
          </li>
          <li className="mood-first-run-step">
            <span className="mood-first-run-step-index">2</span>
            <span className="mood-first-run-step-text">
              {tx.orbFirstRunStep2 ||
                "Choose when you felt this way: now, at a specific time, or all day"}
            </span>
          </li>
          <li className="mood-first-run-step">
            <span className="mood-first-run-step-index">3</span>
            <span className="mood-first-run-step-text">
              {tx.orbFirstRunStep3 ||
                "Add an emotion or note if you want, then save your mood and start today's entry"}
            </span>
          </li>
        </ol>

        <button
          ref={dismissButtonRef}
          type="button"
          data-testid="mood-first-run-dismiss"
          className="mood-first-run-dismiss"
          onClick={dismiss}
        >
          {tx.orbFirstRunGotIt || "Got it"}
        </button>
      </div>
    </section>,
    document.body,
  );
});
