import { useEffect, useId, useRef, useState } from "react";

import { announceError, announceSuccess, createFocusTrap } from "@/lib/a11y";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useModalKeyboard } from "@/hooks/useModalKeyboard";
import type { JournalExportOutcome } from "./journalExport";
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
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!dialogRef.current) return undefined;
    return createFocusTrap(dialogRef.current, {
      initialFocus: titleRef.current,
    });
  }, []);

  const handleClose = () => {
    if (exporting) return;
    onClose();
  };

  useModalKeyboard({
    isOpen: true,
    onClose: handleClose,
    trapFocus: false,
    restoreFocus: false,
  });

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
        className="fixed bottom-0 inset-x-0 z-[60] max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)] overflow-y-auto overscroll-contain motion-safe:animate-slide-up lg:max-w-4xl lg:mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1 bg-card rounded-t-2xl">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>
        <div className="bg-card pb-[max(1.25rem,var(--safe-bottom))] ps-[max(1.25rem,var(--safe-inline-start))] pe-[max(1.25rem,var(--safe-inline-end))] pt-5">
          <h3 ref={titleRef} id={titleId} tabIndex={-1} className="mb-3 min-w-0 whitespace-normal break-words text-base font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word]">
            {ts.journalExportFormat || "Export Format"}
          </h3>
          <p id={warningId} className="mb-3 min-w-0 whitespace-normal break-words rounded-lg border border-border/20 bg-muted/30 px-3 py-2 text-xs leading-snug text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
            {ts.journalExportPrivacyWarning ||
              "Exports are private files and are not encrypted by ZenFlow. Keep them somewhere you trust."}
          </p>
          {error ? (
            <p id={errorId} role="alert" className="mb-3 min-w-0 whitespace-normal break-words text-sm text-destructive [hyphens:manual] [overflow-wrap:break-word]">
              {error}
            </p>
          ) : null}
          <div className="zf-auto-fit-grid-10 grid gap-2">
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
                    let outcome: JournalExportOutcome | undefined;
                    if (fmt.key === "json") {
                      outcome = await exp.exportJSON(
                        undefined,
                        ts.journalExportJSON || "ZenFlow journal backup",
                        language,
                      );
                    } else if (fmt.key === "csv") {
                      outcome = await exp.exportCSV(language, fmt.label);
                    } else if (fmt.key === "md") {
                      outcome = await exp.exportMarkdown(language, fmt.label);
                    }
                    if (outcome === "cancelled") return;
                    announceSuccess(
                      outcome === "started"
                        ? ts.journalExportStarted || "Download started"
                        : ts.journalExportSuccess || "Export complete"
                    );
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
                  "h-auto min-h-[44px] min-w-0 whitespace-normal break-words rounded-xl p-3 text-start [hyphens:manual] [overflow-wrap:break-word] motion-safe:transition-all",
                  "bg-muted/30 border border-border/15",
                  "hover:bg-muted/50 active:scale-[0.98]",
                  "disabled:opacity-50"
                )}
              >
                <p className="min-w-0 whitespace-normal break-words text-sm font-medium text-foreground [hyphens:manual] [overflow-wrap:break-word]">{fmt.label}</p>
                <p className="mt-1 min-w-0 whitespace-normal break-words text-xs leading-snug text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">{fmt.desc}</p>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={exporting}
            className="mt-3 h-auto min-h-[44px] w-full min-w-0 whitespace-normal break-words px-3 py-2.5 text-sm text-muted-foreground [hyphens:manual] [overflow-wrap:break-word] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ts.cancel || "Cancel"}
          </button>
        </div>
      </div>
    </>
  );
}
