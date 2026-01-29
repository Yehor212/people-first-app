/**
 * Export Service
 *
 * Provides functionality to export user data in various formats:
 * - CSV: For spreadsheet analysis
 * - PDF: For printable reports
 *
 * All exports respect user privacy and contain only their own data.
 */

import { jsPDF } from 'jspdf';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { formatDate } from './utils';
import { logger } from './logger';

// ============================================
// CSV EXPORT
// ============================================

/**
 * Convert array of objects to CSV string
 */
const arrayToCSV = <T extends Record<string, unknown>>(
  data: T[],
  columns: Array<{ key: keyof T; header: string }>
): string => {
  if (data.length === 0) return '';

  const headers = columns.map(c => `"${c.header}"`).join(',');
  const rows = data.map(item =>
    columns
      .map(col => {
        const value = item[col.key];
        if (value === null || value === undefined) return '""';
        if (typeof value === 'string') {
          // Escape quotes and wrap in quotes
          return `"${value.replace(/"/g, '""')}"`;
        }
        if (Array.isArray(value)) {
          return `"${value.join('; ')}"`;
        }
        return `"${String(value)}"`;
      })
      .join(',')
  );

  return [headers, ...rows].join('\n');
};

/**
 * Sanitize filename by removing/replacing unsafe characters
 */
const sanitizeFilename = (filename: string): string => {
  // Remove/replace characters that are unsafe in filenames across platforms
  return filename
    .replace(/[<>:"/\\|?*]/g, '_') // Windows-unsafe chars
    .replace(/[\x00-\x1f]/g, '') // Control characters
    .replace(/^\.+/, '') // Leading dots
    .slice(0, 200); // Limit length
};

/**
 * Download a file (CSV or other text format)
 */
const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const safeFilename = sanitizeFilename(filename);
  const blob = new Blob(['\ufeff' + content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export moods to CSV
 */
export const exportMoodsToCSV = (moods: MoodEntry[]): void => {
  const columns = [
    { key: 'date' as const, header: 'Date' },
    { key: 'mood' as const, header: 'Mood' },
    { key: 'note' as const, header: 'Note' },
    { key: 'tags' as const, header: 'Tags' },
  ];

  const csv = arrayToCSV(moods, columns);
  const filename = `zenflow_moods_${formatDate(new Date())}.csv`;
  downloadFile(csv, filename, 'text/csv');
  logger.log('[Export] Moods exported to CSV:', moods.length, 'entries');
};

/**
 * Export habits to CSV
 */
export const exportHabitsToCSV = (habits: Habit[]): void => {
  const columns = [
    { key: 'name' as const, header: 'Habit Name' },
    { key: 'type' as const, header: 'Type' },
    { key: 'icon' as const, header: 'Icon' },
    { key: 'completedDates' as const, header: 'Completed Dates' },
    { key: 'createdAt' as const, header: 'Created At' },
  ];

  // Transform data for export
  const exportData = habits.map(h => ({
    ...h,
    completedDates: h.completedDates || [],
    createdAt: new Date(h.createdAt).toISOString(),
  }));

  const csv = arrayToCSV(exportData, columns);
  const filename = `zenflow_habits_${formatDate(new Date())}.csv`;
  downloadFile(csv, filename, 'text/csv');
  logger.log('[Export] Habits exported to CSV:', habits.length, 'habits');
};

/**
 * Export focus sessions to CSV
 */
export const exportFocusSessionsToCSV = (sessions: FocusSession[]): void => {
  const columns = [
    { key: 'date' as const, header: 'Date' },
    { key: 'duration' as const, header: 'Duration (minutes)' },
    { key: 'label' as const, header: 'Label' },
    { key: 'status' as const, header: 'Status' },
    { key: 'reflection' as const, header: 'Reflection' },
  ];

  const csv = arrayToCSV(sessions, columns);
  const filename = `zenflow_focus_${formatDate(new Date())}.csv`;
  downloadFile(csv, filename, 'text/csv');
  logger.log('[Export] Focus sessions exported to CSV:', sessions.length, 'sessions');
};

/**
 * Export gratitude entries to CSV
 */
export const exportGratitudeToCSV = (entries: GratitudeEntry[]): void => {
  const columns = [
    { key: 'date' as const, header: 'Date' },
    { key: 'text' as const, header: 'Gratitude' },
  ];

  const csv = arrayToCSV(entries, columns);
  const filename = `zenflow_gratitude_${formatDate(new Date())}.csv`;
  downloadFile(csv, filename, 'text/csv');
  logger.log('[Export] Gratitude entries exported to CSV:', entries.length, 'entries');
};

/**
 * Export all data to a single CSV with multiple sections
 */
export const exportAllToCSV = (data: {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
}): void => {
  let csv = '';

  // Moods section
  csv += '=== MOOD TRACKING ===\n';
  csv += arrayToCSV(data.moods, [
    { key: 'date' as const, header: 'Date' },
    { key: 'mood' as const, header: 'Mood' },
    { key: 'note' as const, header: 'Note' },
  ]);

  // Habits section
  csv += '\n\n=== HABITS ===\n';
  csv += arrayToCSV(
    data.habits.map(h => ({
      name: h.name,
      type: h.type,
      totalCompletions: h.completedDates?.length || 0,
    })),
    [
      { key: 'name' as const, header: 'Habit Name' },
      { key: 'type' as const, header: 'Type' },
      { key: 'totalCompletions' as const, header: 'Total Completions' },
    ]
  );

  // Focus sessions section
  csv += '\n\n=== FOCUS SESSIONS ===\n';
  csv += arrayToCSV(data.focusSessions, [
    { key: 'date' as const, header: 'Date' },
    { key: 'duration' as const, header: 'Duration (min)' },
    { key: 'label' as const, header: 'Label' },
  ]);

  // Gratitude section
  csv += '\n\n=== GRATITUDE JOURNAL ===\n';
  csv += arrayToCSV(data.gratitudeEntries, [
    { key: 'date' as const, header: 'Date' },
    { key: 'text' as const, header: 'Entry' },
  ]);

  const filename = `zenflow_export_${formatDate(new Date())}.csv`;
  downloadFile(csv, filename, 'text/csv');
  logger.log('[Export] All data exported to CSV');
};

// ============================================
// PDF EXPORT
// ============================================

interface PDFSection {
  title: string;
  content: string;
}

/**
 * Generate a PDF progress report
 */
export const exportProgressReportPDF = (data: {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  userName?: string;
  dateRange?: { start: string; end: string };
}): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Helper to add text with word wrap
  const addText = (text: string, fontSize: number = 10, isBold: boolean = false): void => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);

    // Check if we need a new page
    if (y + lines.length * fontSize * 0.4 > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }

    doc.text(lines, margin, y);
    y += lines.length * fontSize * 0.4 + 5;
  };

  // Title
  doc.setFillColor(16, 185, 129); // Emerald color
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('ZenFlow Progress Report', margin, 28);

  doc.setTextColor(0, 0, 0);
  y = 50;

  // User info and date
  const today = formatDate(new Date());
  addText(`Generated: ${today}`, 10);
  if (data.userName) {
    addText(`User: ${data.userName}`, 10);
  }
  y += 10;

  // Summary Statistics
  addText('Summary Statistics', 16, true);
  y += 5;

  const totalFocusMinutes = data.focusSessions.reduce((sum, s) => sum + s.duration, 0);
  const totalHabitCompletions = data.habits.reduce(
    (sum, h) => sum + (h.completedDates?.length || 0),
    0
  );

  addText(`Total Mood Entries: ${data.moods.length}`);
  addText(`Total Habits Tracked: ${data.habits.length}`);
  addText(`Total Habit Completions: ${totalHabitCompletions}`);
  addText(`Total Focus Time: ${Math.floor(totalFocusMinutes / 60)}h ${totalFocusMinutes % 60}m`);
  addText(`Gratitude Entries: ${data.gratitudeEntries.length}`);
  y += 10;

  // Mood Distribution
  addText('Mood Distribution', 16, true);
  y += 5;

  const moodCounts = data.moods.reduce(
    (acc, m) => {
      acc[m.mood] = (acc[m.mood] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const moodLabels: Record<string, string> = {
    great: 'Great',
    good: 'Good',
    okay: 'Okay',
    bad: 'Bad',
    terrible: 'Terrible',
  };

  Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([mood, count]) => {
      const percentage = data.moods.length > 0
        ? Math.round((count / data.moods.length) * 100)
        : 0;
      addText(`${moodLabels[mood] || mood}: ${count} (${percentage}%)`);
    });
  y += 10;

  // Top Habits
  addText('Your Habits', 16, true);
  y += 5;

  data.habits
    .sort((a, b) => (b.completedDates?.length || 0) - (a.completedDates?.length || 0))
    .slice(0, 10)
    .forEach(habit => {
      const completions = habit.completedDates?.length || 0;
      addText(`${habit.icon || '✨'} ${habit.name || 'Habit'}: ${completions} completions`);
    });
  y += 10;

  // Recent Gratitude (last 5)
  if (data.gratitudeEntries.length > 0) {
    addText('Recent Gratitude Entries', 16, true);
    y += 5;

    data.gratitudeEntries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
      .forEach(entry => {
        addText(`${entry.date}: "${entry.text.slice(0, 100)}${entry.text.length > 100 ? '...' : ''}"`);
      });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${pageCount} | Generated by ZenFlow`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save
  const filename = sanitizeFilename(`zenflow_report_${formatDate(new Date())}.pdf`);
  doc.save(filename);
  logger.log('[Export] Progress report exported to PDF');
};

/**
 * Export weekly summary as PDF
 */
export const exportWeeklySummaryPDF = (data: {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  weekStart: string;
  weekEnd: string;
}): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Filter data for the week
  const weekMoods = data.moods.filter(m => m.date >= data.weekStart && m.date <= data.weekEnd);
  const weekFocus = data.focusSessions.filter(f => f.date >= data.weekStart && f.date <= data.weekEnd);
  const weekGratitude = data.gratitudeEntries.filter(
    g => g.date >= data.weekStart && g.date <= data.weekEnd
  );

  // Title
  doc.setFillColor(59, 130, 246); // Blue
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Weekly Summary', margin, 24);
  doc.setFontSize(12);
  doc.text(`${data.weekStart} to ${data.weekEnd}`, margin, 32);

  doc.setTextColor(0, 0, 0);
  y = 45;

  // Weekly stats
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('This Week at a Glance', margin, y);
  y += 10;

  const totalFocusMinutes = weekFocus.reduce((sum, s) => sum + s.duration, 0);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Mood entries: ${weekMoods.length}`, margin, y);
  y += 6;
  doc.text(`Focus time: ${Math.floor(totalFocusMinutes / 60)}h ${totalFocusMinutes % 60}m`, margin, y);
  y += 6;
  doc.text(`Gratitude entries: ${weekGratitude.length}`, margin, y);
  y += 15;

  // Calculate habit completions for the week
  let weeklyCompletions = 0;
  data.habits.forEach(habit => {
    const completions = habit.completedDates?.filter(
      d => d >= data.weekStart && d <= data.weekEnd
    ).length || 0;
    weeklyCompletions += completions;
  });
  doc.text(`Habit completions: ${weeklyCompletions}`, margin, y - 9);

  // Save
  const filename = sanitizeFilename(`zenflow_weekly_${data.weekStart}_${data.weekEnd}.pdf`);
  doc.save(filename);
  logger.log('[Export] Weekly summary exported to PDF');
};

export default {
  exportMoodsToCSV,
  exportHabitsToCSV,
  exportFocusSessionsToCSV,
  exportGratitudeToCSV,
  exportAllToCSV,
  exportProgressReportPDF,
  exportWeeklySummaryPDF,
};
