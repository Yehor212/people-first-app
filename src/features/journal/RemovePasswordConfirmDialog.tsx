import { useEffect, useId, useRef, useState } from "react";

import { createFocusTrap } from "@/lib/a11y";
import { useModalKeyboard } from "@/hooks/useModalKeyboard";
import type { JournalPasswordRemovalResult } from "./journalSecurityErrors";
import {
  getJournalPasswordRemovalBlockerMessage,
  getJournalPasswordRemovalCleanupMessage,
} from "./journalPasswordRemovalPresentation";

interface RemovePasswordConfirmDialogProps {
  ts: Record<string, string>;
  onClose: () => void;
  onConfirm: () => Promise<JournalPasswordRemovalResult>;
  onResult?: (result: JournalPasswordRemovalResult) => void;
  getReturnFocusFallback?: () => HTMLElement | null;
}

export function RemovePasswordConfirmDialog({
  ts,
  onClose,
  onConfirm,
  onResult,
  getReturnFocusFallback,
}: RemovePasswordConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const detailId = useId();
  const errorId = useId();
  const statusId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completionStatus, setCompletionStatus] = useState("");

  useEffect(() => {
    if (!dialogRef.current) return undefined;
    return createFocusTrap(dialogRef.current, {
      initialFocus: cancelButtonRef.current,
      returnFocusFallback: getReturnFocusFallback,
    });
  }, [getReturnFocusFallback]);

  useEffect(() => {
    if (completionStatus) cancelButtonRef.current?.focus();
  }, [completionStatus]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  useModalKeyboard({
    isOpen: true,
    onClose: handleClose,
    closeOnEscape: !isSubmitting,
    trapFocus: false,
    restoreFocus: false,
  });

  const handleConfirm = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    setCompletionStatus("");

    try {
      const result = await onConfirm();
      onResult?.(result);

      if (result.status === "blocked") {
        setError(getJournalPasswordRemovalBlockerMessage(ts, result.blocker));
        return;
      }
      if (result.status === "removed-cleanup-pending") {
        setCompletionStatus(
          getJournalPasswordRemovalCleanupMessage(ts, result.pending),
        );
        return;
      }

      onClose();
    } catch {
      setError(
        ts.journalLockRemoveUnexpected ||
          "The diary lock could not be removed. Nothing changed. Try again.",
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
        aria-describedby={[
          descriptionId,
          detailId,
          error ? errorId : "",
          completionStatus ? statusId : "",
        ].filter(Boolean).join(" ")}
        aria-busy={isSubmitting}
        tabIndex={-1}
        className="zf-safe-area-dialog fixed z-[71] mx-auto max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl bg-card p-4 shadow-xl motion-safe:animate-scale-in sm:p-6 lg:max-w-lg"
      >
        <h3 id={titleId} className="mb-2 min-w-0 whitespace-normal break-words text-base font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word]">
          {ts.journalPasswordRemove || "Remove Password Lock"}
        </h3>
        <p id={descriptionId} className="mb-5 min-w-0 whitespace-normal break-words text-sm text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
          {ts.journalPasswordRemoveConfirm ||
            "Are you sure? Your diary will be accessible without a password."}
        </p>
        <p id={detailId} className="mb-5 min-w-0 whitespace-normal break-words text-sm leading-6 text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
          {ts.journalLockRemoveDetail ||
            "Your entries stay saved, but the diary lock and biometric diary unlock will be turned off. You can set a new lock later."}
        </p>
        {error ? (
          <p id={errorId} role="alert" className="mb-4 min-w-0 whitespace-normal break-words text-sm text-destructive [hyphens:manual] [overflow-wrap:break-word]">
            {error}
          </p>
        ) : null}
        {completionStatus ? (
          <p
            id={statusId}
            role="status"
            aria-live="polite"
            className="mb-4 min-w-0 whitespace-normal break-words text-sm text-foreground [hyphens:manual] [overflow-wrap:break-word]"
          >
            {completionStatus}
          </p>
        ) : null}
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="h-auto min-h-[48px] w-full min-w-0 flex-1 whitespace-normal break-words rounded-xl bg-muted px-3 py-2.5 text-sm font-medium text-foreground [hyphens:manual] [overflow-wrap:break-word] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {completionStatus ? ts.done || "Done" : ts.cancel || "Cancel"}
          </button>
          {!completionStatus ? (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="h-auto min-h-[48px] w-full min-w-0 flex-1 whitespace-normal break-words rounded-xl bg-destructive px-3 py-2.5 text-sm font-medium text-destructive-foreground [hyphens:manual] [overflow-wrap:break-word] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting
                ? ts.journalPasswordRemovePending || "Removing lock..."
                : ts.journalPasswordRemove || "Remove Password Lock"}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
