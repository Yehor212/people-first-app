import { useCallback, useId, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";

import { useModalA11y } from "@/hooks/useModalA11y";

interface JournalAiConsentDialogProps {
  open: boolean;
  busy: boolean;
  error: boolean;
  ts: Record<string, string>;
  restoreFocusTo?: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function JournalAiConsentDialog({
  open,
  busy,
  error,
  ts,
  restoreFocusTo,
  onCancel,
  onConfirm,
}: JournalAiConsentDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => onCancel(), [onCancel]);
  const { modalRef, modalProps, handleKeyDown } = useModalA11y(
    open,
    close,
    restoreFocusTo,
  );

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/40 motion-safe:animate-fade-in"
        aria-hidden="true"
        onClick={close}
      />
      <div
        {...modalProps}
        ref={modalRef}
        onKeyDown={handleKeyDown}
        aria-labelledby={titleId}
        aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
        aria-busy={busy}
        className="zf-safe-area-dialog fixed z-[71] mx-auto max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl bg-card p-4 shadow-xl motion-safe:animate-scale-in sm:p-6"
      >
        <h3 id={titleId} className="min-w-0 whitespace-normal break-words text-base font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word]">
          {ts.journalAiSearchPrivacy || "Private search privacy"}
        </h3>
        <p id={descriptionId} className="mt-3 min-w-0 whitespace-normal break-words text-sm leading-6 text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
          {ts.journalAiPrivacyConfirm ||
            "Private search runs only against journal entries in your ZenFlow account. No journal text or query is sent to an external AI provider."}
        </p>
        {error ? (
          <p id={errorId} role="alert" className="mt-3 min-w-0 whitespace-normal break-words text-sm leading-6 text-destructive [hyphens:manual] [overflow-wrap:break-word]">
            {ts.journalAiConsentUnavailable ||
              "Private search could not be enabled. Your diary stays unchanged; try again when you are online."}
          </p>
        ) : null}
        <div className="mt-6 flex min-w-0 flex-col gap-3 sm:flex-row">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={close}
            className="h-auto min-h-[44px] w-full min-w-0 flex-1 whitespace-normal break-words rounded-xl bg-muted px-3 py-2.5 text-sm font-medium text-foreground [hyphens:manual] [overflow-wrap:break-word]"
          >
            {ts.cancel || "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy}
            className="h-auto min-h-[44px] w-full min-w-0 flex-1 whitespace-normal break-words rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground [hyphens:manual] [overflow-wrap:break-word] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? ts.journalAiIndexing || "Preparing private search..."
              : ts.journalAiConsentAccept || "Enable private search"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
