import { useCallback, useEffect, useRef, useState } from "react";
import {
  DatabaseBackup,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useScrollLock } from "@/hooks/useScrollLock";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/stores";
import { useDataExport } from "@/components/settings/data-section/useDataExport";
import { useDataImport } from "@/components/settings/data-section/useDataImport";
import {
  ActionButton,
  PanelFrame,
  SettingsButtonGrid,
  SettingsChoiceButton,
  SettingsDialog,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsInset,
  SettingsStatus,
  SettingsTextInput,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";

export function DataPanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const hasValidSession = useAppStore((state) => state.hasValidSession);
  const [dataStatus, setDataStatus] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");
  const [isResettingData, setIsResettingData] = useState(false);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
  const resetConfirmationRef = useRef<HTMLDivElement>(null);
  const shouldRestoreResetFocusRef = useRef(false);
  const exp = useDataExport({
    setDataStatus,
    t: tx,
    moods: controls.moods ?? [],
    habits: controls.habits,
    focusSessions: controls.focusSessions ?? [],
    gratitudeEntries: controls.gratitudeEntries ?? [],
    userName: controls.userName,
  });
  const imp = useDataImport({ setDataStatus, t: tx });
  const { handleImportCancel, showImportConfirm } = imp;
  const resetConfirmWord = (tx.resetDataConfirmWord || "RESET").trim();
  const resetTypeLabel = (tx.resetDataTypeConfirm || "Type RESET to confirm").replace(
    "{word}",
    resetConfirmWord,
  );
  const resetConfirmMatches = resetConfirmInput.trim() === resetConfirmWord;
  const canResetLocalData = hasValidSession === false;

  const clearResetConfirm = useCallback((restoreFocus = true) => {
    shouldRestoreResetFocusRef.current = restoreFocus;
    setShowResetConfirm(false);
    setResetConfirmInput("");
  }, []);

  const closeResetConfirm = useCallback(() => {
    if (isResettingData) return false;
    clearResetConfirm();
    return true;
  }, [clearResetConfirm, isResettingData]);

  useBackHandler(showResetConfirm && (canResetLocalData || isResettingData), () => {
    closeResetConfirm();
  });
  useBackHandler(showImportConfirm, handleImportCancel);
  useScrollLock(showImportConfirm);

  useEffect(() => {
    if (!canResetLocalData && showResetConfirm && !isResettingData) clearResetConfirm(false);
  }, [canResetLocalData, clearResetConfirm, isResettingData, showResetConfirm]);

  useEffect(() => {
    if (showResetConfirm || !shouldRestoreResetFocusRef.current) return;
    shouldRestoreResetFocusRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      resetTriggerRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showResetConfirm]);

  useEffect(() => {
    if (!showResetConfirm || !canResetLocalData) return;
    const frame = window.requestAnimationFrame(() => {
      const confirmation = resetConfirmationRef.current;
      confirmation?.scrollIntoView?.({ block: "start", inline: "nearest" });
      confirmation?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [canResetLocalData, showResetConfirm]);

  useEffect(() => {
    if (!showImportConfirm && !(showResetConfirm && (canResetLocalData || isResettingData))) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (showImportConfirm) handleImportCancel();
      else closeResetConfirm();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    canResetLocalData,
    closeResetConfirm,
    handleImportCancel,
    isResettingData,
    showImportConfirm,
    showResetConfirm,
  ]);

  const handleReset = async () => {
    if (!canResetLocalData || !resetConfirmMatches) return;
    setIsResettingData(true);
    setDataStatus(null);
    try {
      await controls.onResetData();
      clearResetConfirm();
      setDataStatus(tx.resetDataSuccess || "Your local ZenFlow data has been reset.");
    } catch (error) {
      logger.error("[V2Settings] Local data reset failed", error);
      setDataStatus(tx.resetDataError || "Data reset failed. Please try again.");
    } finally {
      setIsResettingData(false);
    }
  };

  return (
    <>
      <PanelFrame
        icon={DatabaseBackup}
        title={tx.settingsExportImportTitle || "Backups & reports"}
        description={
          tx.settingsDataBackupReportsDescription ||
          "Save a backup you can import later, or create a report."
        }
        testId="settings-v2-panel-data"
      >
        <section
          aria-label={tx.settingsBackupRestoreTitle || "Backup & restore"}
          data-testid="settings-v2-backup-restore-group"
        >
          <SettingsInset>
            <SettingsFieldHeader
              icon={FileJson}
              title={tx.settingsBackupRestoreTitle || "Backup & restore"}
            />
            <ActionButton
              icon={exp.isExporting ? Loader2 : FileJson}
              onClick={() => {
                void exp.handleExport();
              }}
              disabled={exp.isExporting}
              isLoading={exp.isExporting}
              variant="primary"
              testId="settings-v2-export-json"
            >
              {exp.isExporting
                ? tx.exporting || "Exporting..."
                : tx.settingsExportTitle || "Save backup"}
            </ActionButton>

            <div
              className="space-y-2.5 border-t border-[hsl(var(--settings-v2-border)/0.24)] pt-3"
              data-testid="settings-v2-import-options"
            >
              <SettingsFieldHeader title={tx.importMode || "How to import"} />
              <SettingsButtonGrid
                columns="confirm"
                role="group"
                ariaLabel={tx.importMode || "How to import"}
              >
                {(["merge", "replace"] as const).map((mode) => (
                  <SettingsChoiceButton
                    key={mode}
                    onClick={() => imp.setImportMode(mode)}
                    selected={imp.importMode === mode}
                    presentation="compact"
                    selectedTone={mode === "replace" ? "danger" : "subtle"}
                    surface="card"
                    testId={`settings-v2-import-mode-${mode}`}
                  >
                    {mode === "merge"
                      ? tx.importMerge || "Add to current data"
                      : tx.importReplace || "Replace current data"}
                  </SettingsChoiceButton>
                ))}
              </SettingsButtonGrid>
              <input
                ref={imp.fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={imp.handleImportFile}
              />
              <ActionButton
                icon={imp.isImporting ? Loader2 : Upload}
                onClick={imp.handleImportClick}
                disabled={imp.isImporting}
                isLoading={imp.isImporting}
                variant={imp.importMode === "replace" ? "danger" : "secondary"}
                testId="settings-v2-import"
              >
                {imp.isImporting
                  ? tx.importing || "Importing..."
                  : tx.settingsImportTitle || "Import backup"}
              </ActionButton>
            </div>
          </SettingsInset>
        </section>

        <section
          aria-label={tx.settingsReportsTitle || "Reports"}
          data-testid="settings-v2-reports-group"
        >
          <SettingsInset>
            <SettingsFieldHeader
              icon={FileSpreadsheet}
              title={tx.settingsReportsTitle || "Reports"}
              description={
                tx.settingsReportsDescription ||
                "Reports include mood, habits, focus, and gratitude. The PDF is currently in English. Reports are not backups."
              }
            />
            <SettingsButtonGrid columns="two">
              <ActionButton
                icon={exp.isExportingCSV ? Loader2 : FileSpreadsheet}
                onClick={exp.handleExportCSV}
                disabled={exp.isExportingCSV}
                isLoading={exp.isExportingCSV}
                testId="settings-v2-export-csv"
              >
                {tx.settingsReportSpreadsheetAction || "Spreadsheet data (CSV)"}
              </ActionButton>
              <ActionButton
                icon={exp.isExportingPDF ? Loader2 : FileText}
                onClick={() => {
                  void exp.handleExportPDF();
                }}
                disabled={exp.isExportingPDF}
                isLoading={exp.isExportingPDF}
                testId="settings-v2-export-pdf"
              >
                {tx.settingsReportProgressAction || "Progress report (PDF)"}
              </ActionButton>
            </SettingsButtonGrid>
          </SettingsInset>
        </section>

        <div role="status" aria-live="polite">
          <SettingsStatus>{dataStatus}</SettingsStatus>
        </div>

        {(canResetLocalData || (showResetConfirm && isResettingData)) &&
          (!showResetConfirm ? (
            <ActionButton
              buttonRef={resetTriggerRef}
              icon={Trash2}
              variant="danger"
              onClick={() => {
                setResetConfirmInput("");
                setShowResetConfirm(true);
              }}
              testId="settings-v2-reset-data"
            >
              {tx.resetAllData || "Reset all data"}
            </ActionButton>
          ) : (
            <SettingsInset
              className="scroll-mt-[calc(var(--safe-top)+4rem)]"
              containerRef={resetConfirmationRef}
              tone="danger"
              testId="settings-v2-reset-confirmation"
              tabIndex={-1}
              role="group"
              ariaLabel={`${tx.areYouSure || "Are you sure?"} ${
                tx.cannotBeUndone || "This cannot be undone."
              }`}
            >
              <SettingsFieldHeader
                tone="danger"
                title={`${tx.areYouSure || "Are you sure?"} ${
                  tx.cannotBeUndone || "This cannot be undone."
                }`}
                description={
                  tx.resetDataScope ||
                  "This removes local moods, habits, focus, gratitude, journal data, queues, and settings."
                }
              />
              <SettingsFieldHeader
                htmlFor="settings-v2-reset-confirm"
                tone="danger"
                title={resetTypeLabel}
              />
              <SettingsTextInput
                id="settings-v2-reset-confirm"
                value={resetConfirmInput}
                onChange={setResetConfirmInput}
                autoComplete="off"
                disabled={isResettingData}
                tone="danger"
              />
              <SettingsButtonGrid columns="confirm">
                <SettingsInlineButton
                  onClick={() => {
                    closeResetConfirm();
                  }}
                  disabled={isResettingData}
                >
                  {tx.cancel}
                </SettingsInlineButton>
                <SettingsInlineButton
                  icon={isResettingData ? Loader2 : undefined}
                  isLoading={isResettingData}
                  onClick={() => {
                    void handleReset();
                  }}
                  disabled={isResettingData || !resetConfirmMatches}
                  variant="danger"
                >
                  {isResettingData
                    ? tx.resetting || "Resetting..."
                    : tx.resetDataConfirmAction || tx.resetAllData || "Reset data"}
                </SettingsInlineButton>
              </SettingsButtonGrid>
            </SettingsInset>
          ))}
      </PanelFrame>

      {imp.showImportConfirm && imp.pendingImportFile && (
        <SettingsDialog
          titleId="settings-v2-import-title"
          title={tx.importConfirmTitle || "Import backup"}
          description={
            imp.importMode === "replace"
              ? tx.settingsImportReplaceTooltip ||
                "This replaces current moods, habits, focus sessions, gratitude, and settings included in backups. Diary areas are replaced only when they are present in the backup. Protection settings for this device stay unchanged."
              : tx.importConfirmMessage || "Import data from this backup?"
          }
          detail={imp.pendingImportFile.name}
          cancelLabel={tx.cancel}
          confirmLabel={
            imp.importMode === "replace"
              ? tx.importReplace || "Replace current data"
              : tx.settingsImportTitle || "Import backup"
          }
          confirmVariant={imp.importMode === "replace" ? "danger" : "primary"}
          onCancel={imp.handleImportCancel}
          onConfirm={() => {
            void imp.handleImportConfirm();
          }}
        />
      )}
    </>
  );
}
