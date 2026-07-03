import { useEffect, useId, useRef, useState } from "react";

import { announceError, announceSuccess, createFocusTrap } from "@/lib/a11y";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
interface ExportPickerDialogProps {
  ts: Record<string, string>;
  language: import("@/i18n/types").Language;
  exporting: boolean;
  setExporting: (v: boolean) => void;
  onClose: () => void;
}

export function ExportPickerDialog({
  ts,
  language,
  exporting,
  setExporting,
  onClose,
}: ExportPickerDialogProps) {
  const titleId = useId();
  const warningId = useId();
  const errorId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!dialogRef.current) return undefined;
    return createFocusTrap(dialogRef.current, {
      initialFocus: cancelButtonRef.current,
    });
  }, []);

  const handleClose = () => {
    if (exporting) return;
    onClose();
  };

  return (
    <>
      {/* // A11Y-OK: backdrop is decorative overlay dismissed by click — aria-hidden excludes from AT tree */}
      <div
        className="fixed inset-0 z-[55] bg-black/30 motion-safe:animate-fade-in"
        aria-hidden="true"
        onClick={handleClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? `${warningId} ${errorId}` : warningId}
        aria-busy={exporting}
        className="fixed bottom-0 inset-x-0 z-[60] max-h-[calc(100dvh_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom)_-_1rem)] overflow-y-auto motion-safe:animate-slide-up pb-safe lg:max-w-4xl lg:mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1 bg-card rounded-t-2xl">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>
        <div className="bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <h3 id={titleId} className="text-base font-semibold text-foreground mb-3">
            {ts.journalExportFormat || "Export Format"}
          </h3>
          <p id={warningId} className="mb-3 rounded-lg border border-border/20 bg-muted/30 px-3 py-2 text-xs leading-snug text-muted-foreground">
            {ts.journalExportPrivacyWarning ||
              "Exports are private files and are not encrypted by ZenFlow. Keep them somewhere you trust."}
          </p>
          {error ? (
            <p id={errorId} role="alert" className="mb-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                {
                  key: "json",
                  label: ts.journalExportJSON || "JSON Backup",
                  desc: ts.journalExportJSONDesc || "Full backup with photos & audio",
                },
                {
                  key: "csv",
                  label: ts.journalExportCSV || "CSV",
                  desc: ts.journalExportCSVDesc || "Spreadsheet format",
                },
                {
                  key: "pdf",
                  label: ts.journalExportPDF || "PDF",
                  desc: ts.journalExportPDFDesc || "Printable document",
                },
                {
                  key: "md",
                  label: ts.journalExportText || "Markdown",
                  desc: ts.journalExportTextDesc || "Plain text format",
                },
              ] as const
            ).map((fmt) => (
              <button
                key={fmt.key}
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  setError("");
                  try {
                    const exp = await import("./journalExport");
                    if (fmt.key === "json") await exp.exportJSON();
                    else if (fmt.key === "csv") await exp.exportCSV(language);
                    else if (fmt.key === "pdf") await exp.exportPDF(undefined, language);
                    else if (fmt.key === "md") await exp.exportMarkdown(language);
                    announceSuccess(ts.journalExportSuccess || "Export complete");
                    onClose();
                  } catch (err) {
                    logger.warn("[Journal] Export failed:", err);
                    const message = ts.journalExportFailed || "Export failed. Try again.";
                    setError(message);
                    announceError(message);
                  } finally {
                    setExporting(false);
                  }
                }}
                className={cn(
                  "p-3 rounded-xl text-start motion-safe:transition-all min-h-[44px]",
                  "bg-muted/30 border border-border/15",
                  "hover:bg-muted/50 active:scale-[0.98]",
                  "disabled:opacity-50"
                )}
              >
                <p className="text-sm font-medium text-foreground">{fmt.label}</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{fmt.desc}</p>
              </button>
            ))}
          </div>
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={handleClose}
            disabled={exporting}
            className="w-full mt-3 py-2.5 text-sm text-muted-foreground min-h-[44px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ts.cancel || "Cancel"}
          </button>
        </div>
      </div>
    </>
  );
}
