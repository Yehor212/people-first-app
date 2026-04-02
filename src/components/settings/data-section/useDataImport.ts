import { useCallback, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import { analytics } from "@/lib/analytics";
import { safeJsonParse } from "@/lib/safeJson";
import { importBackup, type ImportMode } from "@/storage/backup";

interface UseDataImportOptions {
  setDataStatus: (status: string | null) => void;
  t: Record<string, string>;
}

export function useDataImport({ setDataStatus, t }: UseDataImportOptions) {
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [isImporting, setIsImporting] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportClick = () => {
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

    // Security: Limit file size (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setDataStatus(t.fileTooLarge || "File is too large. Maximum size is 10MB.");
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
    setShowImportConfirm(false);
    setPendingImportFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleImportConfirm = async () => {
    if (!pendingImportFile) return;

    setShowImportConfirm(false);
    setIsImporting(true);
    setDataStatus(null);

    try {
      const text = await pendingImportFile.text();
      const payload = safeJsonParse(text, null);

      if (!payload || typeof payload !== "object") {
        setDataStatus(
          t.invalidBackupFormat ||
            "Invalid backup format. The file does not contain valid JSON data."
        );
        setPendingImportFile(null);
        return;
      }

      const report = await importBackup(payload, importMode);
      const formatEntry = (
        label: string,
        entry: { added: number; updated: number; skipped: number }
      ) =>
        `${label} ${t.importAdded} ${entry.added}, ${t.importUpdated} ${entry.updated}, ${t.importSkipped} ${entry.skipped}`;
      setDataStatus(
        `${t.importSuccess} ${t.importedItems}: ` +
          `${formatEntry(t.moodEntries, report.moods)}; ` +
          `${formatEntry(t.habits, report.habits)}; ` +
          `${formatEntry(t.focus, report.focusSessions)}; ` +
          `${formatEntry(t.gratitude, report.gratitudeEntries)}; ` +
          `${formatEntry(t.settings, report.settings)}.`
      );
      const totalImported =
        report.moods.added +
        report.habits.added +
        report.focusSessions.added +
        report.gratitudeEntries.added;
      analytics.dataImported(totalImported);
    } catch (error) {
      logger.error("Import failed:", error);
      setDataStatus(t.importError);
    } finally {
      setIsImporting(false);
      setPendingImportFile(null);
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
