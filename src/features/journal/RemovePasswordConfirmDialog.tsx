import type { TranslationStrings } from "@/i18n/types";

interface RemovePasswordConfirmDialogProps {
  ts: TranslationStrings;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function RemovePasswordConfirmDialog({
  ts,
  onClose,
  onConfirm,
}: RemovePasswordConfirmDialogProps) {
  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/40 motion-safe:animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[71] bg-card rounded-2xl p-6 shadow-xl motion-safe:animate-scale-in max-w-sm lg:max-w-lg mx-auto"
      >
        <h3 className="text-base font-semibold text-foreground mb-2">
          {ts.journalPasswordRemove || "Remove Password Lock"}
        </h3>
        <p className="text-sm text-muted-foreground mb-5">
          {ts.journalPasswordRemoveConfirm ||
            "Are you sure? Your diary will be accessible without a password."}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium min-h-[44px]"
          >
            {ts.cancel || "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium min-h-[44px]"
          >
            {ts.journalPasswordRemove || "Remove"}
          </button>
        </div>
      </div>
    </>
  );
}
