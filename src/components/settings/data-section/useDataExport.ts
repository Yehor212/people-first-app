import { useState } from 'react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from '@/lib/platform';
import { logger } from '@/lib/logger';
import { exportBackup } from '@/storage/backup';
import { exportAllToCSV, exportProgressReportPDF } from '@/lib/exportService';
import type { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';

interface UseDataExportOptions {
  setDataStatus: (status: string | null) => void;
  t: Record<string, string>;
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  userName: string;
}

export function useDataExport({ setDataStatus, t, moods, habits, focusSessions, gratitudeEntries, userName }: UseDataExportOptions) {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setDataStatus(null);
    try {
      const payload = await exportBackup();
      const json = JSON.stringify(payload, null, 2);
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `ZenFlow_Backup_${dateStr}_${now.getTime()}.json`;

      if (isNative) {
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
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    setIsExportingCSV(true);
    try {
      exportAllToCSV({ moods, habits, focusSessions, gratitudeEntries });
    } catch (e) {
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
      logger.error('[Settings] PDF export error:', e);
    } finally {
      setIsExportingPDF(false);
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
