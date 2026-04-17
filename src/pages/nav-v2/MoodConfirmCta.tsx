import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticSuccess, hapticTap } from "@/lib/haptics";
import "./MoodConfirmCta.css";

/**
 * MoodConfirmCta — Phase 3-A.4b glassy confirm button + skip link +
 * 5-second undo toast.
 *
 * Render order:
 *   1. Confirm CTA button (glassy pill). Disabled until `enabled`.
 *   2. Skip link below ("Позже" — no judgment, clears draft).
 *   3. When confirm is tapped: schedule commit, render toast with undo for 5s.
 *
 * Props:
 *   - `enabled`  → gates pointer-events on confirm (draft complete?)
 *   - `onConfirm` → invoked AFTER the 5s window passes (real persist)
 *   - `onSkip`    → invoked immediately (clears draft, no save)
 *
 * a11y: toast uses role=status + aria-live=polite for screen readers.
 * Law 10: toast portals to body to escape any transform ancestors.
 */

const UNDO_WINDOW_MS = 5000;

export interface MoodConfirmCtaProps {
  enabled: boolean;
  onConfirm: () => void;
  onSkip: () => void;
}

export const MoodConfirmCta = memo(function MoodConfirmCta({
  enabled,
  onConfirm,
  onSkip,
}: MoodConfirmCtaProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const [toastVisible, setToastVisible] = useState(false);
  const [toastRemaining, setToastRemaining] = useState(0);
  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startedAtRef.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const handleConfirm = useCallback(() => {
    if (!enabled) return;
    void hapticSuccess();
    startedAtRef.current = Date.now();
    setToastRemaining(UNDO_WINDOW_MS);
    setToastVisible(true);

    // Tick countdown every 100ms for visual feedback
    intervalRef.current = window.setInterval(() => {
      if (startedAtRef.current === null) return;
      const elapsed = Date.now() - startedAtRef.current;
      const remaining = Math.max(0, UNDO_WINDOW_MS - elapsed);
      setToastRemaining(remaining);
    }, 100) as unknown as number;

    // Commit after the undo window expires
    timerRef.current = window.setTimeout(() => {
      clearTimers();
      setToastVisible(false);
      onConfirm();
    }, UNDO_WINDOW_MS) as unknown as number;
  }, [enabled, onConfirm, clearTimers]);

  const handleUndo = useCallback(() => {
    void hapticTap();
    clearTimers();
    setToastVisible(false);
  }, [clearTimers]);

  const handleSkip = useCallback(() => {
    void hapticTap();
    onSkip();
  }, [onSkip]);

  const percentRemaining = Math.min(
    100,
    Math.max(0, (toastRemaining / UNDO_WINDOW_MS) * 100),
  );

  const toast =
    toastVisible && typeof document !== "undefined"
      ? createPortal(
          <div
            role="status"
            aria-live="polite"
            data-testid="mood-undo-toast"
            className="mood-undo-toast"
          >
            <span className="mood-undo-toast-text">
              {tx.orbMoodSaved || "Mood saved"}
            </span>
            <button
              type="button"
              data-testid="mood-undo-toast-button"
              className="mood-undo-toast-button"
              onClick={handleUndo}
            >
              {tx.orbUndo || "Undo"}
            </button>
            <span
              data-testid="mood-undo-toast-progress"
              className="mood-undo-toast-progress"
              aria-hidden="true"
              style={{ width: `${percentRemaining}%` }}
            />
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className="mood-confirm-stack"
      data-testid="mood-confirm-stack"
      data-enabled={enabled ? "true" : "false"}
    >
      <button
        type="button"
        data-testid="mood-confirm-button"
        className={[
          "mood-confirm-button",
          enabled ? "mood-confirm-button-enabled" : "mood-confirm-button-idle",
        ].join(" ")}
        disabled={!enabled}
        onClick={handleConfirm}
        aria-disabled={!enabled}
      >
        {tx.orbConfirm || "Save"}
      </button>

      <button
        type="button"
        data-testid="mood-skip-button"
        className="mood-skip-button"
        onClick={handleSkip}
      >
        {tx.orbSkip || "Later"}
      </button>

      {toast}
    </div>
  );
});
