import { useRef, useState, useEffect } from 'react';
import { Download, Upload, Trash2, Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { safeJsonParse } from '@/lib/safeJson';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PrivacySection } from '@/components/settings/PrivacySection';
import { exportBackup, importBackup, ImportMode } from '@/storage/backup';
import { exportAllToCSV, exportProgressReportPDF } from '@/lib/exportService';
import type { PrivacySettings, MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';

interface DataSectionProps {
  onResetData: () => void;
  privacy: PrivacySettings;
  onPrivacyChange: (value: PrivacySettings | ((prev: PrivacySettings) => PrivacySettings)) => void;
  moods?: MoodEntry[];
  habits: Habit[];
  focusSessions?: FocusSession[];
  gratitudeEntries?: GratitudeEntry[];
  userName: string;
}

export function DataSection({
  onResetData,
  privacy,
  onPrivacyChange,
  moods = [],
  habits,
  focusSessions = [],
  gratitudeEntries = [],
  userName,
}: DataSectionProps) {
  const { t } = useLanguage();

  // Data-related state
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [dataStatus, setDataStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Back handler + scroll lock for reset confirmation
  useBackHandler(showResetConfirm, () => setShowResetConfirm(false));
  // Back handler + scroll lock for import confirmation modal
  useBackHandler(showImportConfirm, () => handleImportCancel());
  useScrollLock(showResetConfirm || showImportConfirm);

  // Auto-clear dataStatus after 3 seconds
  useEffect(() => {
    if (!dataStatus) return;
    const timer = window.setTimeout(() => setDataStatus(null), 3000);
    return () => window.clearTimeout(timer);
  }, [dataStatus]);

  // --- Export handlers ---

  const handleExport = async () => {
    setIsExporting(true);
    setDataStatus(null);
    try {
      const payload = await exportBackup();
      const json = JSON.stringify(payload, null, 2);
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `ZenFlow_Backup_${dateStr}_${now.getTime()}.json`;

      if (Capacitor.isNativePlatform()) {
        const file = await Filesystem.writeFile({
          path: filename,
          data: json,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        await Share.share({
          title: 'ZenFlow backup',
          text: filename,
          url: file.uri,
          dialogTitle: 'Share backup',
        });
        setDataStatus(t.exportSuccess);
        return;
      }

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDataStatus(t.exportSuccess);
    } catch (error) {
      logger.error('Export failed:', error);
      setDataStatus(t.exportError);
      toast.error(t.exportError || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    setIsExportingCSV(true);
    try {
      exportAllToCSV({ moods, habits, focusSessions, gratitudeEntries });
    } catch (e) {
      toast.error(t.exportError || 'Export failed');
      logger.error('[Settings] CSV export error:', e);
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleExportPDF = () => {
    setIsExportingPDF(true);
    try {
      exportProgressReportPDF({ moods, habits, focusSessions, gratitudeEntries, userName });
    } catch (e) {
      toast.error(t.exportError || 'Export failed');
      logger.error('[Settings] PDF export error:', e);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // --- Import handlers ---

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Security: Validate file type
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setDataStatus(t.invalidFileType || 'Invalid file type. Please select a JSON file.');
      event.target.value = '';
      return;
    }

    // Security: Limit file size (10MB max)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setDataStatus(t.fileTooLarge || 'File is too large. Maximum size is 10MB.');
      event.target.value = '';
      return;
    }

    // Store file for confirmation modal instead of window.confirm
    setPendingImportFile(file);
    setShowImportConfirm(true);

    // Reset the input so the same file can be re-selected if needed
    event.target.value = '';
  };

  const handleImportCancel = () => {
    setShowImportConfirm(false);
    setPendingImportFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportConfirm = async () => {
    if (!pendingImportFile) return;

    setShowImportConfirm(false);
    setIsImporting(true);
    setDataStatus(null);

    try {
      const text = await pendingImportFile.text();
      const payload = safeJsonParse(text, null);

      if (!payload || typeof payload !== 'object') {
        setDataStatus(t.invalidBackupFormat || 'Invalid backup format. The file does not contain valid JSON data.');
        setPendingImportFile(null);
        return;
      }

      const report = await importBackup(payload, importMode);
      const formatEntry = (label: string, entry: { added: number; updated: number; skipped: number }) =>
        `${label} ${t.importAdded} ${entry.added}, ${t.importUpdated} ${entry.updated}, ${t.importSkipped} ${entry.skipped}`;
      setDataStatus(
        `${t.importSuccess} ${t.importedItems}: ` +
          `${formatEntry(t.moodEntries, report.moods)}; ` +
          `${formatEntry(t.habits, report.habits)}; ` +
          `${formatEntry(t.focus, report.focusSessions)}; ` +
          `${formatEntry(t.gratitude, report.gratitudeEntries)}; ` +
          `${formatEntry(t.settings, report.settings)}.`
      );
    } catch (error) {
      logger.error('Import failed:', error);
      setDataStatus(t.importError);
      toast.error(t.importError || 'Import failed');
    } finally {
      setIsImporting(false);
      setPendingImportFile(null);
    }
  };

  // --- Reset handler ---

  const handleReset = () => {
    onResetData();
    setShowResetConfirm(false);
  };

  return (
    <>
      <AccordionItem value="data" className="bg-card rounded-2xl shadow-zen-sm border overflow-hidden">
        <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 zen-gradient-sunset rounded-xl shadow-[0_4px_20px_-4px_hsl(350_60%_65%/0.25)]">
              <Download className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">{t.settingsGroupData}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          <div className="space-y-4">
            {/* Info message */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-900 dark:text-blue-100">
                {t.settingsExportDescription || 'Your data is stored locally on your device. Export backups regularly to prevent data loss.'}
              </p>
            </div>

            <div className="space-y-3">
              {/* Export button - Primary style */}
              <button
                onClick={handleExport}
                disabled={isExporting}
                aria-label={t.settingsExportTitle || t.exportData}
                className="w-full py-4 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity zen-shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? <Loader2 className="w-5 h-5 motion-safe:animate-spin" aria-label={t.exporting || 'Exporting...'} /> : <Download className="w-5 h-5" />}
                <span>{isExporting ? (t.exporting || 'Exporting...') : (t.settingsExportTitle || t.exportData)}</span>
              </button>

              {/* Export CSV and PDF buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={isExportingCSV}
                  aria-label={t.exportCSV || 'CSV'}
                  className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExportingCSV ? <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-label={t.exporting || 'Exporting...'} /> : <FileSpreadsheet className="w-4 h-4" />}
                  <span>{t.exportCSV || 'CSV'}</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isExportingPDF}
                  aria-label={t.exportPDF || 'PDF Report'}
                  className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExportingPDF ? <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-label={t.exporting || 'Exporting...'} /> : <FileText className="w-4 h-4" />}
                  <span>{t.exportPDF || 'PDF Report'}</span>
                </button>
              </div>

              {/* Import mode selector */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">{t.importMode}</label>
                <div className="flex gap-2 mb-2" role="group" aria-label={t.importMode}>
                  <button
                    onClick={() => setImportMode('merge')}
                    aria-pressed={importMode === 'merge'}
                    aria-label={t.importMerge}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      importMode === 'merge'
                        ? 'bg-primary/10 ring-2 ring-primary text-foreground'
                        : 'bg-secondary text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {t.importMerge}
                  </button>
                  <button
                    onClick={() => setImportMode('replace')}
                    aria-pressed={importMode === 'replace'}
                    aria-label={t.importReplace}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      importMode === 'replace'
                        ? 'bg-destructive/10 ring-2 ring-destructive text-destructive'
                        : 'bg-secondary text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {t.importReplace}
                  </button>
                </div>
                {/* Tooltip text */}
                <p className="text-xs text-muted-foreground">
                  {importMode === 'merge'
                    ? (t.settingsImportMergeTooltip || 'Imported data will be added to existing. Duplicates skipped.')
                    : (t.settingsImportReplaceTooltip || 'All current data will be deleted and replaced with import')}
                </p>
              </div>

              {/* Import button + hidden file input */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImportFile}
                />
                <button
                  onClick={handleImportClick}
                  disabled={isImporting}
                  aria-label={t.settingsImportTitle || t.importData}
                  className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? <Loader2 className="w-5 h-5 motion-safe:animate-spin" aria-label={t.importing || 'Importing...'} /> : <Upload className="w-5 h-5" />}
                  <span>{isImporting ? (t.importing || 'Importing...') : (t.settingsImportTitle || t.importData)}</span>
                </button>
              </div>

              {/* Data status message */}
              <div role="status" aria-live="polite">
                {dataStatus && (
                  <p className="text-sm text-muted-foreground">{dataStatus}</p>
                )}
              </div>

              {/* Privacy Section */}
              <PrivacySection privacy={privacy} onPrivacyChange={onPrivacyChange} />

              {/* Reset All Data - at the bottom after Privacy */}
              {!showResetConfirm ? (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  aria-label={t.resetAllData}
                  className="w-full py-3 bg-destructive/10 text-destructive rounded-xl font-medium hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t.resetAllData}</span>
                </button>
              ) : (
                <div className="p-4 bg-destructive/10 rounded-xl motion-safe:animate-scale-in">
                  <p className="text-destructive font-medium mb-3">
                    {t.areYouSure} {t.cannotBeUndone}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      aria-label={t.cancel}
                      className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg"
                    >
                      {t.cancel}
                    </button>
                    <button
                      onClick={handleReset}
                      aria-label={t.delete}
                      className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg"
                    >
                      {t.delete}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Import confirmation modal */}
      {showImportConfirm && pendingImportFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleImportCancel} />
          <div className="relative bg-card rounded-2xl p-6 w-full max-w-sm shadow-xl motion-safe:animate-scale-in">
            <h3 className="text-lg font-semibold text-foreground mb-2">{t.importConfirmTitle || 'Import Backup'}</h3>
            <p className="text-sm text-muted-foreground mb-1">
              {t.importConfirmMessage || 'Import data from this file?'}
            </p>
            <p className="text-xs text-muted-foreground mb-4 truncate">
              {pendingImportFile.name}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {importMode === 'merge'
                ? (t.settingsImportMergeTooltip || 'Imported data will be added to existing. Duplicates skipped.')
                : (t.settingsImportReplaceTooltip || 'All current data will be deleted and replaced with import')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleImportCancel}
                aria-label={t.cancel}
                className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleImportConfirm}
                aria-label={t.settingsImportTitle || t.importData}
                className="flex-1 py-2 zen-gradient text-primary-foreground rounded-lg font-medium"
              >
                {t.settingsImportTitle || t.importData}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
