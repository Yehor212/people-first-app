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
  return (
    <>
      {/* // A11Y-OK: backdrop is decorative overlay dismissed by click — aria-hidden excludes from AT tree */}
      <div
        className="fixed inset-0 z-[55] bg-black/30 motion-safe:animate-fade-in"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ts.journalExportFormat || "Export Format"}
        className="fixed bottom-0 inset-x-0 z-[60] motion-safe:animate-slide-up pb-safe lg:max-w-4xl lg:mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1 bg-card rounded-t-2xl">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>
        <div className="bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <h3 className="text-base font-semibold text-foreground mb-3">
            {ts.journalExportFormat || "Export Format"}
          </h3>
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
                  try {
                    const exp = await import("./journalExport");
                    if (fmt.key === "json") await exp.exportJSON();
                    else if (fmt.key === "csv") await exp.exportCSV(language);
                    else if (fmt.key === "pdf") await exp.exportPDF(undefined, language);
                    else if (fmt.key === "md") await exp.exportMarkdown(language);
                    onClose();
                  } catch (err) {
                    logger.warn("[Journal] Export failed:", err);
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
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{fmt.desc}</p>
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-full mt-3 py-2.5 text-sm text-muted-foreground min-h-[44px]"
          >
            {ts.cancel || "Cancel"}
          </button>
        </div>
      </div>
    </>
  );
}
