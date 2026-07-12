import { useRef, useState } from "react";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isNative } from "@/lib/platform";
import { logger } from "@/lib/logger";
import { analytics } from "@/lib/analytics";
import { exportPortableBackupArtifact } from "@/storage/backup";
import { exportAllToCSV, exportProgressReportPDF } from "@/lib/exportService";
import type { MoodEntry, Habit, FocusSession, GratitudeEntry } from "@/types";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import {
  assertSettingsOwnerCurrent,
  SettingsOwnerBoundaryError,
} from "@/lib/settingsOwnerBoundary";

interface UseDataExportOptions {
  setDataStatus: (status: string | null) => void;
  t: Record<string, string>;
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  userName: string;
}

function isShareCancellation(error: unknown): boolean {
  return error instanceof Error && /share cancel(?:ed|led)/i.test(error.message);
}

function backupExportStatus(error: unknown, t: Record<string, string>): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;
  if (code === "JOURNAL_UNLOCK_REQUIRED") {
    return t.exportJournalUnlockRequired || t.exportError;
  }
  if (code === "JOURNAL_DECRYPTION_FAILED") {
    return t.exportJournalDecryptionFailed || t.exportError;
  }
  if (code === "JOURNAL_MEDIA_UNAVAILABLE") {
    return t.exportJournalMediaUnavailable || t.exportError;
  }
  if (code === "BACKUP_TOO_LARGE") {
    return t.exportBackupTooLarge || t.exportError;
  }
  return t.exportError;
}

export function useDataExport({
  setDataStatus,
  t,
  moods,
  habits,
  focusSessions,
  gratitudeEntries,
  userName,
}: UseDataExportOptions) {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const exportGenerationRef = useRef(0);
  const csvGenerationRef = useRef(0);
  const pdfGenerationRef = useRef(0);

  const handleExport = async () => {
    const operationGeneration = ++exportGenerationRef.current;
    setIsExporting(true);
    setDataStatus(null);
    let expectedOwnerUserId: string | null = null;
    let ownerCaptured = false;
    try {
      expectedOwnerUserId = await getCurrentSessionUserId();
      ownerCaptured = true;
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "Backup export");
      const { json } = await exportPortableBackupArtifact();
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "Backup export");
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const filename = `ZenFlow_Backup_${dateStr}_${now.getTime()}.json`;
      const shareTitle = t.settingsExportTitle || t.exportData || "ZenFlow backup";

      if (isNative) {
        let shareOutcome: "shared" | "cancelled" = "shared";
        let shareError: unknown;
        let cleanupError: unknown;
        let cacheFileCreated = false;

        try {
          await assertSettingsOwnerCurrent(expectedOwnerUserId, "Native backup export");
          const file = await Filesystem.writeFile({
            path: filename,
            data: json,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
          });
          cacheFileCreated = true;

          try {
            await assertSettingsOwnerCurrent(expectedOwnerUserId, "Native backup share");
            await Share.share({
              title: shareTitle,
              text: filename,
              url: file.uri,
              dialogTitle: shareTitle,
            });
          } catch (error) {
            if (isShareCancellation(error)) {
              shareOutcome = "cancelled";
            } else {
              shareError = error;
            }
          }
        } finally {
          if (cacheFileCreated) {
            try {
              await Filesystem.deleteFile({
                path: filename,
                directory: Directory.Cache,
              });
            } catch (error) {
              cleanupError = error;
              logger.error("Native backup cache cleanup failed:", error);
            }
          }
        }

        await assertSettingsOwnerCurrent(expectedOwnerUserId, "Native backup completion");
        if (operationGeneration !== exportGenerationRef.current) return;

        if (shareError) {
          throw shareError instanceof Error
            ? shareError
            : new Error("Native backup share failed");
        }
        if (shareOutcome === "cancelled") {
          if (cleanupError) {
            setDataStatus(t.exportCleanupError || t.exportError);
          }
          return;
        }

        analytics.dataExported();
        setDataStatus(cleanupError ? t.exportCleanupError || t.exportError : t.exportSuccess);
        return;
      }

      await assertSettingsOwnerCurrent(expectedOwnerUserId, "Web backup download");
      if (operationGeneration !== exportGenerationRef.current) return;
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      try {
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        URL.revokeObjectURL(url);
      }
      analytics.dataExported();
      setDataStatus(t.exportSuccess);
    } catch (error) {
      if (error instanceof SettingsOwnerBoundaryError) return;
      if (ownerCaptured) {
        try {
          await assertSettingsOwnerCurrent(expectedOwnerUserId, "Backup export error");
        } catch (ownerError) {
          if (ownerError instanceof SettingsOwnerBoundaryError) return;
          throw ownerError;
        }
      }
      if (operationGeneration !== exportGenerationRef.current) return;
      logger.error("Export failed:", error);
      setDataStatus(backupExportStatus(error, t));
    } finally {
      if (operationGeneration === exportGenerationRef.current) {
        setIsExporting(false);
      }
    }
  };

  const handleExportCSV = async () => {
    const operationGeneration = ++csvGenerationRef.current;
    setIsExportingCSV(true);
    let expectedOwnerUserId: string | null = null;
    let ownerCaptured = false;
    try {
      expectedOwnerUserId = await getCurrentSessionUserId();
      ownerCaptured = true;
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "CSV export");
      if (operationGeneration !== csvGenerationRef.current) return;
      exportAllToCSV({ moods, habits, focusSessions, gratitudeEntries });
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "CSV export completion");
    } catch (e) {
      if (e instanceof SettingsOwnerBoundaryError) return;
      if (ownerCaptured) {
        try {
          await assertSettingsOwnerCurrent(expectedOwnerUserId, "CSV export error");
        } catch (ownerError) {
          if (ownerError instanceof SettingsOwnerBoundaryError) return;
          throw ownerError;
        }
      }
      if (operationGeneration !== csvGenerationRef.current) return;
      logger.error("[Settings] CSV export error:", e);
      setDataStatus(t.exportError || "Export failed");
    } finally {
      if (operationGeneration === csvGenerationRef.current) {
        setIsExportingCSV(false);
      }
    }
  };

  const handleExportPDF = async () => {
    const operationGeneration = ++pdfGenerationRef.current;
    setIsExportingPDF(true);
    let expectedOwnerUserId: string | null = null;
    let ownerCaptured = false;
    try {
      expectedOwnerUserId = await getCurrentSessionUserId();
      ownerCaptured = true;
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "PDF export");
      if (operationGeneration !== pdfGenerationRef.current) return;
      await exportProgressReportPDF({ moods, habits, focusSessions, gratitudeEntries, userName });
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "PDF export completion");
    } catch (e) {
      if (e instanceof SettingsOwnerBoundaryError) return;
      if (ownerCaptured) {
        try {
          await assertSettingsOwnerCurrent(expectedOwnerUserId, "PDF export error");
        } catch (ownerError) {
          if (ownerError instanceof SettingsOwnerBoundaryError) return;
          throw ownerError;
        }
      }
      if (operationGeneration !== pdfGenerationRef.current) return;
      logger.error("[Settings] PDF export error:", e);
      setDataStatus(t.exportError || "Export failed");
    } finally {
      if (operationGeneration === pdfGenerationRef.current) {
        setIsExportingPDF(false);
      }
    }
  };

  return {
    isExporting,
    isExportingCSV,
    isExportingPDF,
    handleExport,
    handleExportCSV,
    handleExportPDF,
  };
}
