import { useEffect, useId, useRef } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useModalKeyboard } from "@/hooks/useModalKeyboard";
import { createFocusTrap } from "@/lib/a11y";
import type { FeatureAvailability } from "@/lib/featureAvailability";

interface FeatureAvailabilityDialogProps {
  availability: FeatureAvailability;
  onClose: () => void;
}

export function FeatureAvailabilityDialog({
  availability,
  onClose,
}: FeatureAvailabilityDialogProps) {
  const { t } = useLanguage();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const isOpen = !availability.visible && availability.disclosure === "user-safe-reason";

  useBackHandler(isOpen, onClose);
  useModalKeyboard({
    isOpen,
    onClose,
    trapFocus: false,
    restoreFocus: false,
  });

  useEffect(() => {
    if (
      availability.visible ||
      availability.disclosure !== "user-safe-reason" ||
      !dialogRef.current
    ) {
      return undefined;
    }
    return createFocusTrap(dialogRef.current, {
      initialFocus: closeButtonRef.current,
    });
  }, [availability.disclosure, availability.visible]);

  if (availability.visible || availability.disclosure !== "user-safe-reason") {
    return null;
  }

  const description = (() => {
    switch (availability.reason) {
      case "journal-count-loading":
        return t.featureUnavailableChecking;
      case "journal-count-unavailable":
        return t.featureUnavailableProgress;
      case "disabled-by-user":
        return t.featureUnavailableDisabled;
      case "unlock-required":
        return t.featureUnavailableUnlock;
      default:
        return t.featureUnavailableGeneric;
    }
  })();

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-[hsl(var(--nav-v2-backdrop)/0.40)] backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="zf-safe-area-dialog fixed z-[71] mx-auto max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl bg-card p-5 text-card-foreground shadow-xl lg:max-w-md"
      >
        <h2 id={titleId} className="text-base font-semibold text-foreground">
          {t.featureUnavailableTitle}
        </h2>
        <p
          id={descriptionId}
          role="status"
          className="mt-3 whitespace-normal break-words text-sm leading-relaxed text-muted-foreground"
        >
          {description}
        </p>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground"
        >
          {t.close}
        </button>
      </div>
    </>
  );
}
