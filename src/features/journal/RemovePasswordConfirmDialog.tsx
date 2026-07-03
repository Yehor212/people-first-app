import { useEffect, useId, useRef, useState } from "react";

import { createFocusTrap } from "@/lib/a11y";

interface RemovePasswordConfirmDialogProps {
  ts: Record<string, string>;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RemovePasswordConfirmDialog({
  ts,
  onClose,
  onConfirm,
}: RemovePasswordConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const detailId = useId();
  const errorId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!dialogRef.current) return undefined;
    return createFocusTrap(dialogRef.current, {
      initialFocus: cancelButtonRef.current,
    });
  }, []);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      await onConfirm();
    } catch {
      setError(
        ts.journalLockRemoveFailed ||
          "Unlock your diary first, then try removing the lock again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/40 dark:bg-black/40 motion-safe:animate-fade-in"
        onClick={handleClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? `${descriptionId} ${detailId} ${errorId}` : `${descriptionId} ${detailId}`}
        aria-busy={isSubmitting}
        className="fixed inset-x-4 top-1/2 z-[71] mx-auto max-h-[calc(100dvh_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom)_-_2rem)] max-w-sm -translate-y-1/2 overflow-y-auto rounded-2xl bg-card p-6 shadow-xl motion-safe:animate-scale-in lg:max-w-lg"
      >
        <h3 id={titleId} className="mb-2 text-base font-semibold text-foreground">
          {ts.journalPasswordRemove || "Remove Password Lock"}
        </h3>
        <p id={descriptionId} className="mb-5 text-sm text-muted-foreground">
          {ts.journalPasswordRemoveConfirm ||
            "Are you sure? Your diary will be accessible without a password."}
        </p>
        <p id={detailId} className="mb-5 text-sm leading-6 text-muted-foreground">
          {ts.journalLockRemoveDetail ||
            "Your entries stay saved, but the diary lock and biometric diary unlock will be turned off. You can set a new lock later."}
        </p>
        {error ? (
          <p id={errorId} role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="min-h-[44px] flex-1 rounded-xl bg-muted py-2.5 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ts.cancel || "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="min-h-[44px] flex-1 rounded-xl bg-destructive py-2.5 text-sm font-medium text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting
              ? ts.journalPasswordRemovePending || "Removing lock..."
              : ts.journalPasswordRemove || "Remove Password Lock"}
          </button>
        </div>
      </div>
    </>
  );
}
