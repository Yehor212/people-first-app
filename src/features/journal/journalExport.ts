/**
 * Journal Export Service
 *
 * Supports: JSON (full backup), CSV, PDF, Markdown
 */

import type { JournalEntry, JournalPhoto, JournalAudio } from "./types";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import * as storage from "./journalStorage";
import { getToday, parseLocalDate } from "@/lib/utils";
import { getLocale } from "@/lib/timeUtils";
import { createSimplePdf } from "@/lib/simplePdf";
import { isNative } from "@/lib/platform";
import { serializePortableBackupWithinLimit } from "@/storage/backupCapacity";
import type { Language } from "@/i18n/translations";
import { getTranslations } from "@/i18n";
import type { TranslationStrings } from "@/i18n/types";
import { getVisibleJournalTags } from "./journalFavorite";
import { formatLocalizedCount } from "./journalWordCount";
import { countWordsHtml } from "./types";
import {
  assertDataWriteBoundaryGeneration,
  captureDataWriteBoundaryGeneration,
} from "@/hooks/useIndexedDB";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import { getLocalDataOwnerId } from "@/storage/db";

// ── Helpers ──

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*]/g, "_")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f]/g, "")
      .replace(/^\.+/, "")
      .slice(0, 200)
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = sanitizeFilename(filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export type JournalExportOutcome = "saved" | "started" | "cancelled";

const MAX_JOURNAL_BACKUP_FILE_BYTES = 50 * 1024 * 1024;

interface JournalExportBoundary {
  generation: number;
  sessionOwnerUserId: string | null;
  localOwnerUserId: string | null;
}

async function captureJournalExportBoundary(): Promise<JournalExportBoundary> {
  const generation = captureDataWriteBoundaryGeneration();
  const [sessionOwnerUserId, localOwnerUserId] = await Promise.all([
    getCurrentSessionUserId(),
    getLocalDataOwnerId(),
  ]);
  assertDataWriteBoundaryGeneration(generation);
  return { generation, sessionOwnerUserId, localOwnerUserId };
}

async function assertJournalExportBoundary(boundary: JournalExportBoundary): Promise<void> {
  assertDataWriteBoundaryGeneration(boundary.generation);
  const [sessionOwnerUserId, localOwnerUserId] = await Promise.all([
    getCurrentSessionUserId(),
    getLocalDataOwnerId(),
  ]);
  assertDataWriteBoundaryGeneration(boundary.generation);
  if (
    sessionOwnerUserId !== boundary.sessionOwnerUserId ||
    localOwnerUserId !== boundary.localOwnerUserId
  ) {
    throw new Error("Account boundary changed during diary export");
  }
}

function isShareCancellation(error: unknown): boolean {
  return error instanceof Error && /share cancel(?:ed|led)/i.test(error.message);
}

async function saveJournalFile(
  content: string,
  filename: string,
  shareTitle: string,
  mimeType: string,
  boundary: JournalExportBoundary,
): Promise<JournalExportOutcome> {
  const safeFilename = sanitizeFilename(filename);
  if (!isNative) {
    await assertJournalExportBoundary(boundary);
    downloadBlob(new Blob([content], { type: `${mimeType};charset=utf-8` }), safeFilename);
    return "started";
  }

  let cacheFileCreated = false;
  let outcome: JournalExportOutcome = "saved";
  try {
    await assertJournalExportBoundary(boundary);
    const file = await Filesystem.writeFile({
      path: safeFilename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    cacheFileCreated = true;

    try {
      await assertJournalExportBoundary(boundary);
      await Share.share({
        title: shareTitle,
        text: safeFilename,
        url: file.uri,
        dialogTitle: shareTitle,
      });
    } catch (error) {
      if (isShareCancellation(error)) outcome = "cancelled";
      else throw error;
    }
  } finally {
    if (cacheFileCreated) {
      await Filesystem.deleteFile({
        path: safeFilename,
        directory: Directory.Cache,
      });
    }
  }

  return outcome;
}

function formatExportCopy(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function getMoodLabel(ts: TranslationStrings, mood: string): string {
  const labels: Record<string, string> = {
    great: ts.moodGreat,
    good: ts.moodGood,
    okay: ts.moodOkay,
    bad: ts.moodBad,
    terrible: ts.moodTerrible,
  };
  return labels[mood] || mood;
}

// ── JSON Export (full backup) ──

interface JournalBackup {
  version: 3;
  exportedAt: number;
  entries: JournalEntry[];
  photos: JournalPhoto[];
  audio: JournalAudio[];
  deletedEntryIds: string[];
}

export async function exportJSON(
  onProgress?: (step: string) => void,
  shareTitle = "ZenFlow journal backup",
  language: Language = "en",
): Promise<JournalExportOutcome> {
  const boundary = await captureJournalExportBoundary();
  const ts = getTranslations(language);
  onProgress?.(ts.journalExportLoadingEntries);
  const snapshot = await storage.getJournalExportSnapshot();
  onProgress?.(ts.journalExportLoadingPhotos);
  onProgress?.(ts.journalExportLoadingAudio);

  const backup: JournalBackup = {
    version: 3,
    exportedAt: Date.now(),
    entries: snapshot.entries,
    photos: snapshot.photos,
    audio: snapshot.audio,
    deletedEntryIds: snapshot.deletedEntryIds,
  };

  onProgress?.(ts.journalExportGeneratingFile);
  const { json } = serializePortableBackupWithinLimit(
    backup,
    MAX_JOURNAL_BACKUP_FILE_BYTES,
  );
  await assertJournalExportBoundary(boundary);
  const dateStr = getToday();
  return saveJournalFile(
    json,
    `journal-backup-${dateStr}.json`,
    shareTitle,
    "application/json",
    boundary,
  );
}

// ── CSV Export ──

export async function exportCSV(
  language: Language = "en",
  shareTitle?: string,
): Promise<JournalExportOutcome> {
  const boundary = await captureJournalExportBoundary();
  const entries = await storage.getAllEntries();
  const locale = getLocale(language);
  const ts = getTranslations(language);

  const headers = [
    ts.journalExportDate,
    ts.journalExportTime,
    ts.journalExportTitle,
    ts.journalExportContent,
    ts.journalExportMood,
    ts.journalExportTags,
    ts.journalExportStickers,
    ts.journalExportWordCount,
    ts.journalExportPhotos,
    ts.journalExportAudio,
  ];
  const rows = entries.map((e) => {
    const dt = new Date(e.createdAt);
    const time = dt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    const wordCount = countWordsHtml(e.content);
    return [
      csvEscape(e.date),
      csvEscape(time),
      csvEscape(e.title),
      csvEscape(e.content),
      csvEscape(e.mood ? getMoodLabel(ts, e.mood) : ""),
      csvEscape(getVisibleJournalTags(e.tags).join(", ")),
      csvEscape(e.stickers.join(" ")),
      csvEscape(String(wordCount)),
      csvEscape(String(e.photoIds.length)),
      csvEscape(String(e.audioIds?.length || 0)),
    ];
  });

  const csv = [headers.map(csvEscape).join(","), ...rows.map((r) => r.join(","))].join("\n");
  await assertJournalExportBoundary(boundary);
  const dateStr = getToday();
  return saveJournalFile(
    "\ufeff" + csv,
    `journal-${dateStr}.csv`,
    shareTitle || ts.journalExportCSV,
    "text/csv",
    boundary,
  );
}

function csvEscape(str: string): string {
  if (!str) return '""';
  const normalized = str.replace(/[\r\n]+/g, " ");
  const formulaLike = /^[\t=+\-@]|^\s+[=+\-@]/.test(normalized);
  const safe = formulaLike ? `'${normalized}` : normalized;
  const escaped = safe.replace(/"/g, '""');
  return `"${escaped}"`;
}

// ── Markdown Export ──

export async function exportMarkdown(
  language: Language = "en",
  shareTitle?: string,
): Promise<JournalExportOutcome> {
  const boundary = await captureJournalExportBoundary();
  const entries = await storage.getAllEntries();
  const locale = getLocale(language);
  const ts = getTranslations(language);

  const lines: string[] = [`# ${ts.journalExportDiary}\n`];

  for (const entry of entries) {
    const visibleTags = getVisibleJournalTags(entry.tags);
    const dt = parseLocalDate(entry.date);
    const dateStr = dt.toLocaleDateString(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const title = entry.title || ts.journalExportUntitled;

    lines.push(`## ${dateStr} — ${title}\n`);

    if (entry.mood) {
      lines.push(`**${ts.journalExportMood}:** ${getMoodLabel(ts, entry.mood)}\n`);
    }

    if (entry.content) {
      lines.push(entry.content + "\n");
    }

    if (visibleTags.length > 0) {
      lines.push(`**${ts.journalExportTags}:** ${visibleTags.map((t) => `#${t}`).join(" ")}\n`);
    }

    if (entry.stickers.length > 0) {
      lines.push(`**${ts.journalExportStickers}:** ${entry.stickers.join(" ")}\n`);
    }

    if (entry.photoIds.length > 0) {
      lines.push(`*${ts.journalExportPhotos}: ${entry.photoIds.length}*\n`);
    }

    if (entry.audioIds && entry.audioIds.length > 0) {
      lines.push(`*${ts.journalExportAudio}: ${entry.audioIds.length}*\n`);
    }

    lines.push("---\n");
  }

  const md = lines.join("\n");
  await assertJournalExportBoundary(boundary);
  const dateStr = getToday();
  return saveJournalFile(
    "\ufeff" + md,
    `journal-${dateStr}.md`,
    shareTitle || ts.journalExportText,
    "text/markdown",
    boundary,
  );
}

// ── PDF Export ──

export async function exportPDF(
  onProgress?: (step: string) => void,
  language: Language = "en"
): Promise<void> {
  const boundary = await captureJournalExportBoundary();
  const ts = getTranslations(language);
  onProgress?.(ts.journalExportLoadingEntries);
  const snapshot = await storage.getJournalExportSnapshot();
  const entries = snapshot.entries;
  const photosByEntry = new Map<string, JournalPhoto[]>();
  for (const photo of snapshot.photos) {
    const current = photosByEntry.get(photo.entryId) || [];
    current.push(photo);
    photosByEntry.set(photo.entryId, current);
  }

  const doc = createSimplePdf();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Cover page
  doc.setFontSize(24);
  doc.setTextColor(60, 60, 60);
  doc.text(ts.journalExportDiary, pageWidth / 2, 60, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(120, 120, 120);
  doc.text(
    formatLocalizedCount(entries.length, language, ts, "journalEntryCount", ts.entries),
    pageWidth / 2,
    72,
    { align: "center" },
  );

  const dateRange =
    entries.length > 0 ? `${entries[entries.length - 1].date} — ${entries[0].date}` : "";
  if (dateRange) {
    doc.text(dateRange, pageWidth / 2, 80, { align: "center" });
  }

  doc.setFontSize(9);
  doc.text(formatExportCopy(ts.journalExportExported, {
    date: new Date().toLocaleString(getLocale(language)),
  }), pageWidth / 2, 95, {
    align: "center",
  });

  // Entries
  onProgress?.(ts.journalExportGeneratingPages);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const visibleTags = getVisibleJournalTags(entry.tags);
    doc.addPage();
    y = margin;

    // Date header
    const dt = parseLocalDate(entry.date);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(
      dt.toLocaleDateString(getLocale(language), {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      margin,
      y
    );
    y += 6;

    // Mood
    if (entry.mood) {
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`${ts.journalExportMood}: ${getMoodLabel(ts, entry.mood)}`, margin, y);
      y += 5;
    }

    // Title
    if (entry.title) {
      doc.setFontSize(14);
      doc.setTextColor(30, 30, 30);
      const titleLines = doc.splitTextToSize(entry.title, maxWidth);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 6 + 3;
    }

    // Content
    if (entry.content) {
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      const contentLines = doc.splitTextToSize(entry.content, maxWidth);
      for (const line of contentLines) {
        checkPage(5);
        doc.text(line, margin, y);
        y += 4.5;
      }
      y += 3;
    }

    // Tags
    if (visibleTags.length > 0) {
      checkPage(6);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 220);
      doc.text(`${ts.journalExportTags}: ${visibleTags.map((t) => "#" + t).join(" ")}`, margin, y);
      y += 5;
    }

    // Photos embedded
    if (entry.photoIds.length > 0) {
      onProgress?.(formatExportCopy(ts.journalExportLoadingEntryPhotos, {
        current: new Intl.NumberFormat(getLocale(language)).format(i + 1),
      }));
      const photos = photosByEntry.get(entry.id) || [];
      for (const photo of photos) {
        checkPage(55);
        try {
          doc.addImage(photo.data, "JPEG", margin, y, 50, 50 * (photo.height / photo.width));
          y += 50 * (photo.height / photo.width) + 5;
        } catch {
          // Skip photo if addImage fails
        }
      }
    }
  }

  await assertJournalExportBoundary(boundary);
  const dateStr = getToday();
  doc.save(`journal-${dateStr}.pdf`);
}
