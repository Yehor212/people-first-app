import { useState, useEffect } from 'react';
import { Download, Upload, Trash2, Loader2, FileText, FileSpreadsheet } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { cn } from '@/lib/utils';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PrivacySection } from '@/components/settings/PrivacySection';
import type { PrivacySettings, MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { useDataExport } from './useDataExport';
import { useDataImport } from './useDataImport';

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
  const tRecord = t as unknown as Record<string, string>;

  const [dataStatus, setDataStatus] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const exp = useDataExport({ setDataStatus, t: tRecord, moods, habits, focusSessions, gratitudeEntries, userName });
  const imp = useDataImport({ setDataStatus, t: tRecord });

  // Back handler + scroll lock for reset confirmation
  useBackHandler(showResetConfirm, () => setShowResetConfirm(false));
  // Back handler + scroll lock for import confirmation modal
  useBackHandler(imp.showImportConfirm, () => imp.handleImportCancel());
  useScrollLock(showResetConfirm || imp.showImportConfirm);

  // Escape key: dismiss import confirm or reset confirm
  useEffect(() => {
    if (!showResetConfirm && !imp.showImportConfirm) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (imp.showImportConfirm) {
          imp.handleImportCancel();
        } else {
          setShowResetConfirm(false);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showResetConfirm, imp]);

  // Auto-clear dataStatus after 3 seconds
  useEffect(() => {
    if (!dataStatus) return;
    const timer = window.setTimeout(() => setDataStatus(null), 3000);
    return () => window.clearTimeout(timer);
  }, [dataStatus]);

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
                onClick={exp.handleExport}
                disabled={exp.isExporting}
                aria-label={t.settingsExportTitle || t.exportData}
                className="w-full py-4 zen-gradient text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity zen-shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exp.isExporting ? <Loader2 className="w-5 h-5 motion-safe:animate-spin" aria-label={t.exporting || 'Exporting...'} /> : <Download className="w-5 h-5" />}
                <span>{exp.isExporting ? (t.exporting || 'Exporting...') : (t.settingsExportTitle || t.exportData)}</span>
              </button>

              {/* Export CSV and PDF buttons */}
              <div className="flex gap-2">
                <button
                  onClick={exp.handleExportCSV}
                  disabled={exp.isExportingCSV}
                  aria-label={t.exportCSV || 'CSV'}
                  className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exp.isExportingCSV ? <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-label={t.exporting || 'Exporting...'} /> : <FileSpreadsheet className="w-4 h-4" />}
                  <span>{t.exportCSV || 'CSV'}</span>
                </button>
                <button
                  onClick={exp.handleExportPDF}
                  disabled={exp.isExportingPDF}
                  aria-label={t.exportPDF || 'PDF Report'}
                  className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exp.isExportingPDF ? <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-label={t.exporting || 'Exporting...'} /> : <FileText className="w-4 h-4" />}
                  <span>{t.exportPDF || 'PDF Report'}</span>
                </button>
              </div>

              {/* Import mode selector */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">{t.importMode}</label>
                <div className="flex gap-2 mb-2" role="group" aria-label={t.importMode}>
                  <button
                    onClick={() => imp.setImportMode('merge')}
                    aria-pressed={imp.importMode === 'merge'}
                    aria-label={t.importMerge}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      imp.importMode === 'merge'
                        ? 'bg-primary/10 ring-2 ring-primary text-foreground'
                        : 'bg-secondary text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {t.importMerge}
                  </button>
                  <button
                    onClick={() => imp.setImportMode('replace')}
                    aria-pressed={imp.importMode === 'replace'}
                    aria-label={t.importReplace}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      imp.importMode === 'replace'
                        ? 'bg-destructive/10 ring-2 ring-destructive text-destructive'
                        : 'bg-secondary text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {t.importReplace}
                  </button>
                </div>
                {/* Tooltip text */}
                <p className="text-xs text-muted-foreground">
                  {imp.importMode === 'merge'
                    ? (t.settingsImportMergeTooltip || 'Imported data will be added to existing. Duplicates skipped.')
                    : (t.settingsImportReplaceTooltip || 'All current data will be deleted and replaced with import')}
                </p>
              </div>

              {/* Import button + hidden file input */}
              <div>
                <input
                  ref={imp.fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={imp.handleImportFile}
                />
                <button
                  onClick={imp.handleImportClick}
                  disabled={imp.isImporting}
                  aria-label={t.settingsImportTitle || t.importData}
                  className="w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {imp.isImporting ? <Loader2 className="w-5 h-5 motion-safe:animate-spin" aria-label={t.importing || 'Importing...'} /> : <Upload className="w-5 h-5" />}
                  <span>{imp.isImporting ? (t.importing || 'Importing...') : (t.settingsImportTitle || t.importData)}</span>
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
      {imp.showImportConfirm && imp.pendingImportFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={imp.handleImportCancel} />
          <div className="relative bg-card rounded-2xl p-6 w-full max-w-sm shadow-xl motion-safe:animate-scale-in">
            <h3 className="text-lg font-semibold text-foreground mb-2">{t.importConfirmTitle || 'Import Backup'}</h3>
            <p className="text-sm text-muted-foreground mb-1">
              {t.importConfirmMessage || 'Import data from this file?'}
            </p>
            <p className="text-xs text-muted-foreground mb-4 truncate">
              {imp.pendingImportFile.name}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {imp.importMode === 'merge'
                ? (t.settingsImportMergeTooltip || 'Imported data will be added to existing. Duplicates skipped.')
                : (t.settingsImportReplaceTooltip || 'All current data will be deleted and replaced with import')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={imp.handleImportCancel}
                aria-label={t.cancel}
                className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg"
              >
                {t.cancel}
              </button>
              <button
                onClick={imp.handleImportConfirm}
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
