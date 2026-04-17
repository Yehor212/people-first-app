import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { haptics } from "@/lib/haptics";
import "./MoodFirstRunHint.css";

/**
 * MoodFirstRunHint — Phase 3-A.4b one-time onboarding nudge.
 *
 * Shows three beats:
 *   1. Slide the orb
 *   2. Choose a scope
 *   3. Confirm
 *
 * Appears only on first visit with zero prior mood entries. Dismissed forever
 * via a localStorage flag (`zenflow-orb-first-run-dismissed`). Survives
 * remount/refresh — does NOT re-render once user dismisses.
 *
 * Law 9 (a11y): role=dialog, aria-modal, Escape to close, focus trap on
 * dismiss button. Law 10: safe-area-aware.
 */

const STORAGE_KEY = "zenflow-orb-first-run-dismissed";

function readDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // storage unavailable — non-fatal. Hint will re-appear next session.
  }
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
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!eligible) return;
    if (readDismissed()) return;
    setVisible(true);
  }, [eligible]);

  useEffect(() => {
    if (!visible) return;
    // Focus the dismiss button when the hint opens
    dismissRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setVisible(false);
        writeDismissed();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!visible || typeof document === "undefined") return null;

  const dismiss = () => {
    void haptics.tabChanged();
    setVisible(false);
    writeDismissed();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mood-first-run-title"
      data-testid="mood-first-run-hint"
      className="mood-first-run-backdrop"
      onClick={dismiss}
    >
      <div
        className="mood-first-run-card"
        onClick={(e) => e.stopPropagation()}
      >
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
              {tx.orbFirstRunStep1 || "Slide the orb to match how you feel"}
            </span>
          </li>
          <li className="mood-first-run-step">
            <span className="mood-first-run-step-index">2</span>
            <span className="mood-first-run-step-text">
              {tx.orbFirstRunStep2 || "Choose a scope (moment, day, or time)"}
            </span>
          </li>
          <li className="mood-first-run-step">
            <span className="mood-first-run-step-index">3</span>
            <span className="mood-first-run-step-text">
              {tx.orbFirstRunStep3 || "Pick an emotion and confirm"}
            </span>
          </li>
        </ol>

        <button
          ref={dismissRef}
          type="button"
          data-testid="mood-first-run-dismiss"
          className="mood-first-run-dismiss"
          onClick={dismiss}
        >
          {tx.orbFirstRunGotIt || "Got it"}
        </button>
      </div>
    </div>,
    document.body,
  );
});
