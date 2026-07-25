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
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsInset,
  SettingsStatus,
  SettingsTextInput,
} from "./components/V2SettingsControlPrimitives";
import { V2SettingsImportDialog } from "./V2SettingsImportDialog";
import type { AccountViewState } from "./useSettingsOverviewModules";
import type { V2SettingsControls } from "./types";

export function DataPanel({
  controls,
  accountViewState,
}: {
  controls: V2SettingsControls;
  accountViewState: AccountViewState;
}) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const isAccountBoundaryInProgress = useAppStore(
    (state) => state.isAccountBoundaryInProgress
  );
  const [dataStatus, setDataStatus] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState("");
  const [isResettingData, setIsResettingData] = useState(false);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
  const importTriggerRef = useRef<HTMLButtonElement>(null);
  const importStatusFocusRef = useRef<HTMLElement>(null);
  const importWasAvailableRef = useRef(false);
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
  const resetTypeTemplate = tx.resetDataTypeConfirm || "Type {word} to confirm";
  const resetTypeMarker = resetTypeTemplate.includes("{word}") ? "{word}" : resetConfirmWord;
  const resetTypeMarkerIndex = resetTypeTemplate.indexOf(resetTypeMarker);
  const resetTypePrefix =
    resetTypeMarkerIndex >= 0
      ? resetTypeTemplate.slice(0, resetTypeMarkerIndex)
      : `${resetTypeTemplate} `;
  const resetTypeSuffix =
    resetTypeMarkerIndex >= 0
      ? resetTypeTemplate.slice(resetTypeMarkerIndex + resetTypeMarker.length)
      : "";
  const resetConfirmMatches = resetConfirmInput.trim() === resetConfirmWord;
  const canResetLocalData = accountViewState === "signed-out";
  const canImportLocalBackup =
    accountViewState === "signed-out" && !isAccountBoundaryInProgress;
  const backupSectionTitle = canImportLocalBackup
    ? tx.settingsBackupRestoreTitle || "Backup & restore"
    : tx.settingsExportTitle || "Save backup";

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
  useScrollLock(showImportConfirm && canImportLocalBackup);

  useEffect(() => {
    if (!canResetLocalData && showResetConfirm && !isResettingData) clearResetConfirm(false);
  }, [canResetLocalData, clearResetConfirm, isResettingData, showResetConfirm]);

  useEffect(() => {
    const importWasAvailable = importWasAvailableRef.current;
    importWasAvailableRef.current = canImportLocalBackup;
    if (canImportLocalBackup || !showImportConfirm) return;
    handleImportCancel();
    if (importWasAvailable) {
      importStatusFocusRef.current?.focus({ preventScroll: true });
    }
  }, [canImportLocalBackup, handleImportCancel, showImportConfirm]);

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
        <p
          className="min-w-0 break-words rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.42)] bg-[hsl(var(--settings-v2-shell)/0.46)] p-3 text-xs leading-relaxed text-muted-foreground [hyphens:manual] [overflow-wrap:break-word]"
          data-testid="settings-v2-export-privacy-warning"
        >
          {tx.journalExportPrivacyWarning}
        </p>

        <section
          aria-label={backupSectionTitle}
          data-testid="settings-v2-backup-restore-group"
          ref={importStatusFocusRef}
          tabIndex={-1}
        >
          <SettingsInset>
            <SettingsFieldHeader
              icon={FileJson}
              title={backupSectionTitle}
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

            {canImportLocalBackup ? (
              <div
                className="space-y-2.5 border-t border-[hsl(var(--settings-v2-border)/0.24)] pt-3"
                data-testid="settings-v2-import-options"
              >
                <input
                  ref={imp.fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={imp.handleImportFile}
                />
                <ActionButton
                  buttonRef={importTriggerRef}
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
            ) : null}
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

        <SettingsStatus>{dataStatus}</SettingsStatus>

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
              <label htmlFor="settings-v2-reset-confirm" className="mb-2.5 block">
                <span className="min-w-0 break-words text-sm font-semibold text-destructive [hyphens:manual] [overflow-wrap:break-word]">
                  {resetTypePrefix}
                  <bdi dir="ltr">{resetConfirmWord}</bdi>
                  {resetTypeSuffix}
                </span>
              </label>
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

      {canImportLocalBackup ? (
        <V2SettingsImportDialog
          copy={tx}
          dataImport={imp}
          confirmFocusRef={importStatusFocusRef}
          returnFocusRef={importTriggerRef}
        />
      ) : null}
    </>
  );
}
