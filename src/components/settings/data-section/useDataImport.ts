import { useCallback, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import { analytics } from "@/lib/analytics";
import { safeJsonParse } from "@/lib/safeJson";
import { runWithDataWriteBarrier } from "@/hooks/useIndexedDB";
import { importBackup, type ImportMode } from "@/storage/backup";
import { MAX_PORTABLE_BACKUP_FILE_BYTES } from "@/storage/backupCapacity";
import { getJournalReplaceAuthorization } from "@/lib/journalContentSession";
import { interpolate } from "@/lib/utils";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import {
  assertSettingsOwnerCurrent,
  SettingsOwnerBoundaryError,
} from "@/lib/settingsOwnerBoundary";

interface UseDataImportOptions {
  setDataStatus: (status: string | null) => void;
  t: Record<string, string>;
}

function isJournalUnlockRequired(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "JOURNAL_UNLOCK_REQUIRED"
  );
}

export function useDataImport({ setDataStatus, t }: UseDataImportOptions) {
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [isImporting, setIsImporting] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importGenerationRef = useRef(0);

  const handleImportClick = () => {
    setImportMode("merge");
    fileInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Security: Validate file type
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      setDataStatus(t.invalidFileType || "Invalid file type. Please select a JSON file.");
      event.target.value = "";
      return;
    }

    // Covers one maximum-size 20 MB recording after base64 expansion while
    // still bounding the in-memory JSON parse on mobile devices.
    if (file.size > MAX_PORTABLE_BACKUP_FILE_BYTES) {
      setDataStatus(t.fileTooLarge || "File is too large. Maximum size is 32 MB.");
      event.target.value = "";
      return;
    }

    // Store file for confirmation modal instead of window.confirm
    setPendingImportFile(file);
    setShowImportConfirm(true);

    // Reset the input so the same file can be re-selected if needed
    event.target.value = "";
  };

  const handleImportCancel = useCallback(() => {
    importGenerationRef.current += 1;
    setShowImportConfirm(false);
    setPendingImportFile(null);
    setImportMode("merge");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleImportConfirm = async () => {
    if (!pendingImportFile) return;

    const operationGeneration = ++importGenerationRef.current;

    setShowImportConfirm(false);
    setIsImporting(true);
    setDataStatus(null);
    let expectedOwnerUserId: string | null = null;
    let ownerCaptured = false;

    try {
      expectedOwnerUserId = await getCurrentSessionUserId();
      ownerCaptured = true;
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "Backup import");
      const text = await pendingImportFile.text();
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "Backup import");
      const payload = safeJsonParse(text, null);

      if (!payload || typeof payload !== "object") {
        await assertSettingsOwnerCurrent(expectedOwnerUserId, "Backup import");
        setDataStatus(
          t.invalidBackupFormat ||
            "Invalid backup format. The file does not contain valid JSON data."
        );
        setPendingImportFile(null);
        return;
      }

      const applyImport = async () => {
        await assertSettingsOwnerCurrent(expectedOwnerUserId, "Backup import");
        const authorization =
          importMode === "replace" ? getJournalReplaceAuthorization() : null;
        const ownerOptions = expectedOwnerUserId
          ? { expectedOwnerUserId }
          : undefined;
        const report = authorization
          ? await importBackup(payload, importMode, {
              ...ownerOptions,
              journalReplaceAuthorization: authorization,
            })
          : await importBackup(payload, importMode, ownerOptions);
        await assertSettingsOwnerCurrent(expectedOwnerUserId, "Backup import");
        return report;
      };
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "Backup import");
      const report = await runWithDataWriteBarrier(applyImport);
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "Backup import");
      const emptyCollection = { added: 0, updated: 0, skipped: 0 };
      const journalEntries = report.journalEntries ?? emptyCollection;
      const journalPhotos = report.journalPhotos ?? emptyCollection;
      const journalAudio = report.journalAudio ?? emptyCollection;
      const journalHubPreferences = report.journalHubPreferences ?? emptyCollection;
      const journalSpaces = report.journalSpaces ?? emptyCollection;
      const journalPracticeSessions = report.journalPracticeSessions ?? emptyCollection;
      const journalEntryLinks = report.journalEntryLinks ?? emptyCollection;
      const journalSpaceCaptures = report.journalSpaceCaptures ?? emptyCollection;
      const collections = [
        report.moods,
        report.habits,
        report.focusSessions,
        report.gratitudeEntries,
        report.settings,
        journalEntries,
        journalPhotos,
        journalAudio,
        journalHubPreferences,
        journalSpaces,
        journalPracticeSessions,
        journalEntryLinks,
        journalSpaceCaptures,
      ];
      const totals = collections.reduce(
        (sum, entry) => ({
          added: sum.added + entry.added,
          updated: sum.updated + entry.updated,
          skipped: sum.skipped + entry.skipped,
        }),
        { added: 0, updated: 0, skipped: 0 },
      );
      if (operationGeneration !== importGenerationRef.current) return;
      setDataStatus(
        interpolate(
          t.importResultSummary ||
            "Import complete — added: {added}, updated: {updated}, skipped: {skipped}. Diary — entries: {journalEntries}, photos: {journalPhotos}, recordings: {journalAudio}.",
          {
            ...totals,
            journalEntries: journalEntries.added + journalEntries.updated,
            journalPhotos: journalPhotos.added + journalPhotos.updated,
            journalAudio: journalAudio.added + journalAudio.updated,
          },
        ),
      );
      const totalImported =
        report.moods.added +
        report.habits.added +
        report.focusSessions.added +
        report.gratitudeEntries.added +
        (report.journalEntries?.added ?? 0) +
        (report.journalPhotos?.added ?? 0) +
        (report.journalAudio?.added ?? 0) +
        (report.journalHubPreferences?.added ?? 0) +
        (report.journalSpaces?.added ?? 0) +
        (report.journalPracticeSessions?.added ?? 0) +
        (report.journalEntryLinks?.added ?? 0) +
        (report.journalSpaceCaptures?.added ?? 0);
      analytics.dataImported(totalImported);
    } catch (error) {
      if (error instanceof SettingsOwnerBoundaryError) return;
      if (ownerCaptured) {
        try {
          await assertSettingsOwnerCurrent(expectedOwnerUserId, "Backup import error");
        } catch (ownerError) {
          if (ownerError instanceof SettingsOwnerBoundaryError) return;
          throw ownerError;
        }
      }
      if (operationGeneration !== importGenerationRef.current) return;
      if (isJournalUnlockRequired(error)) {
        setDataStatus(t.importJournalUnlockRequired || t.importError);
        return;
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "JOURNAL_BACKUP_UNREADABLE"
      ) {
        setDataStatus(t.importJournalUnreadable || t.importError);
        return;
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "JOURNAL_REPLACE_AUTHORIZATION_REQUIRED"
      ) {
        setDataStatus(
          t.importJournalReauthorizationRequired ||
            "For safety, lock and unlock your diary, then return here and try Replace again.",
        );
        return;
      }
      logger.error("Import failed:", error);
      setDataStatus(t.importError);
    } finally {
      if (operationGeneration === importGenerationRef.current) {
        setIsImporting(false);
        setPendingImportFile(null);
      }
    }
  };

  return {
    importMode,
    setImportMode,
    isImporting,
    showImportConfirm,
    pendingImportFile,
    fileInputRef,
    handleImportClick,
    handleImportFile,
    handleImportCancel,
    handleImportConfirm,
  };
}
