import { useCallback, useId } from "react";

import { useModalA11y } from "@/hooks/useModalA11y";
import type { JournalImportInspection } from "./journalImport";

interface JournalImportConfirmDialogProps {
  ts: Record<string, string>;
  filename: string;
  inspection: JournalImportInspection;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function JournalImportConfirmDialog({
  ts,
  filename,
  inspection,
  busy,
  onCancel,
  onConfirm,
}: JournalImportConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const warningId = useId();
  const close = useCallback(() => {
    if (!busy) onCancel();
  }, [busy, onCancel]);
  const { modalProps, handleKeyDown } = useModalA11y(true, close);
  const rows = [
    [ts.journalEntries || ts.journalImportEntries || "Entries", inspection.entries],
    [ts.journalExportPhotos || "Photos", inspection.photos],
    [ts.journalExportAudio || "Audio", inspection.audio],
    [ts.journalImportErrors || "Issues", inspection.issues],
    ...(inspection.deletionHistoryIncluded
      ? [[ts.journalImportDeletedHistory || "Deletion history", inspection.deletions] as const]
      : []),
  ] as const;
  const deletionWarning = (
    ts.journalImportDeletionWarning ||
    "This backup records {count} deleted entries. Matching entries on this device will be permanently removed."
  ).replace("{count}", String(inspection.deletions));

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/40 motion-safe:animate-fade-in"
        aria-hidden="true"
        onClick={close}
      />
      <div
        {...modalProps}
        onKeyDown={handleKeyDown}
        aria-labelledby={titleId}
        aria-describedby={
          inspection.deletionHistoryIncluded
            ? inspection.deletions > 0
              ? `${descriptionId} ${warningId}`
              : descriptionId
            : `${descriptionId} ${warningId}`
        }
        aria-busy={busy}
        className="zf-safe-area-dialog fixed z-[71] mx-auto max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl bg-card p-4 shadow-xl motion-safe:animate-scale-in sm:p-6 lg:max-w-lg"
      >
        <h3 id={titleId} className="min-w-0 whitespace-normal break-words text-base font-semibold text-foreground [hyphens:manual] [overflow-wrap:break-word]">
          {ts.journalImport || "Import backup"}
        </h3>
        <p id={descriptionId} className="mt-2 min-w-0 whitespace-normal break-words text-sm leading-6 text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">
          {ts.journalImportHint ||
            "Review this backup before adding its entries to your diary."}
        </p>
        <p
          className="mt-4 min-w-0 max-w-full whitespace-normal break-words rounded-lg border border-border/20 bg-muted/30 px-3 py-2 text-sm text-foreground [overflow-wrap:anywhere]"
          dir="auto"
        >
          {filename}
        </p>
        <dl className="zf-auto-fit-grid-9 mt-4 grid gap-x-5 gap-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex min-w-0 items-baseline justify-between gap-3">
              <dt className="min-w-0 whitespace-normal break-words text-sm text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]">{label}</dt>
              <dd className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        {inspection.deletionHistoryIncluded && inspection.deletions > 0 ? (
          <p
            id={warningId}
            role="note"
            className="mt-4 min-w-0 whitespace-normal break-words rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm leading-6 text-foreground [hyphens:manual] [overflow-wrap:break-word]"
          >
            {deletionWarning}
          </p>
        ) : null}
        {!inspection.deletionHistoryIncluded ? (
          <p
            id={warningId}
            role="note"
            className="mt-4 min-w-0 whitespace-normal break-words rounded-lg border border-border/30 bg-muted/40 px-3 py-2 text-sm leading-6 text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]"
          >
            {ts.journalImportLegacyWarning ||
              "This older backup has no deletion history, so entries deleted before it was created may be restored."}
          </p>
        ) : null}
        <div className="mt-6 flex min-w-0 flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="h-auto min-h-[44px] w-full min-w-0 flex-1 whitespace-normal break-words rounded-xl bg-muted px-3 py-2.5 text-sm font-medium text-foreground [hyphens:manual] [overflow-wrap:break-word] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ts.cancel || "Cancel"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-auto min-h-[44px] w-full min-w-0 flex-1 whitespace-normal break-words rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground [hyphens:manual] [overflow-wrap:break-word] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? ts.journalImporting || "Importing backup..."
              : ts.journalImport || "Import backup"}
          </button>
        </div>
      </div>
    </>
  );
}
