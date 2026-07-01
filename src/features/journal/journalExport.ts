/**
 * Journal Export Service
 *
 * Supports: JSON (full backup), CSV, PDF, Markdown
 */

import type { JournalEntry, JournalPhoto, JournalAudio } from "./types";
import * as storage from "./journalStorage";
import { getToday } from "@/lib/utils";
import { getLocale } from "@/lib/timeUtils";
import { createSimplePdf } from "@/lib/simplePdf";
import type { Language } from "@/i18n/translations";

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

function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob(["\ufeff" + content], { type: `${mimeType};charset=utf-8;` });
  downloadBlob(blob, filename);
}

const MOOD_LABEL: Record<string, string> = {
  great: "Great",
  good: "Good",
  okay: "Okay",
  bad: "Bad",
  terrible: "Terrible",
};

// ── JSON Export (full backup) ──

interface JournalBackup {
  version: 2;
  exportedAt: number;
  entries: JournalEntry[];
  photos: JournalPhoto[];
  audio: JournalAudio[];
}

export async function exportJSON(onProgress?: (step: string) => void): Promise<void> {
  onProgress?.("Loading entries...");
  const entries = await storage.getAllEntries();

  onProgress?.("Loading photos...");
  const photos: JournalPhoto[] = [];
  for (const entry of entries) {
    if (entry.photoIds.length > 0) {
      const entryPhotos = await storage.getPhotosForEntry(entry.id);
      photos.push(...entryPhotos);
    }
  }

  onProgress?.("Loading audio...");
  const audio: JournalAudio[] = [];
  for (const entry of entries) {
    if (entry.audioIds && entry.audioIds.length > 0) {
      const entryAudio = await storage.getAudioForEntry(entry.id);
      audio.push(...entryAudio);
    }
  }

  const backup: JournalBackup = {
    version: 2,
    exportedAt: Date.now(),
    entries,
    photos,
    audio,
  };

  onProgress?.("Generating file...");
  const json = JSON.stringify(backup, null, 2);
  const dateStr = getToday();
  downloadText(json, `journal-backup-${dateStr}.json`, "application/json");
}

// ── CSV Export ──

export async function exportCSV(language: Language = "en"): Promise<void> {
  const entries = await storage.getAllEntries();
  const locale = getLocale(language);

  const headers = [
    "Date",
    "Time",
    "Title",
    "Content",
    "Mood",
    "Tags",
    "Stickers",
    "Word Count",
    "Photos",
    "Audio",
  ];
  const rows = entries.map((e) => {
    const dt = new Date(e.createdAt);
    const time = dt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    const wordCount = e.content.trim() ? e.content.trim().split(/\s+/).filter(Boolean).length : 0;
    return [
      csvEscape(e.date),
      csvEscape(time),
      csvEscape(e.title),
      csvEscape(e.content.slice(0, 500)),
      csvEscape(e.mood ? MOOD_LABEL[e.mood] || e.mood : ""),
      csvEscape(e.tags.join(", ")),
      csvEscape(e.stickers.join(" ")),
      csvEscape(String(wordCount)),
      csvEscape(String(e.photoIds.length)),
      csvEscape(String(e.audioIds?.length || 0)),
    ];
  });

  const csv = [headers.map(csvEscape).join(","), ...rows.map((r) => r.join(","))].join("\n");
  const dateStr = getToday();
  downloadText(csv, `journal-${dateStr}.csv`, "text/csv");
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

export async function exportMarkdown(language: Language = "en"): Promise<void> {
  const entries = await storage.getAllEntries();
  const locale = getLocale(language);

  const lines: string[] = ["# Diary\n"];

  for (const entry of entries) {
    const dt = new Date(entry.createdAt);
    const dateStr = dt.toLocaleDateString(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const title = entry.title || "Untitled";

    lines.push(`## ${dateStr} — ${title}\n`);

    if (entry.mood) {
      lines.push(`**Mood:** ${MOOD_LABEL[entry.mood] || entry.mood}\n`);
    }

    if (entry.content) {
      lines.push(entry.content + "\n");
    }

    if (entry.tags.length > 0) {
      lines.push(`**Tags:** ${entry.tags.map((t) => `#${t}`).join(" ")}\n`);
    }

    if (entry.stickers.length > 0) {
      lines.push(`**Stickers:** ${entry.stickers.join(" ")}\n`);
    }

    if (entry.photoIds.length > 0) {
      lines.push(`*${entry.photoIds.length} photo(s) attached*\n`);
    }

    if (entry.audioIds && entry.audioIds.length > 0) {
      lines.push(`*${entry.audioIds.length} audio recording(s) attached*\n`);
    }

    lines.push("---\n");
  }

  const md = lines.join("\n");
  const dateStr = getToday();
  downloadText(md, `journal-${dateStr}.md`, "text/markdown");
}

// ── PDF Export ──

export async function exportPDF(
  onProgress?: (step: string) => void,
  language: Language = "en"
): Promise<void> {
  onProgress?.("Loading entries...");
  const entries = await storage.getAllEntries();

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
  doc.text("Diary", pageWidth / 2, 60, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(120, 120, 120);
  doc.text(`${entries.length} entries`, pageWidth / 2, 72, { align: "center" });

  const dateRange =
    entries.length > 0 ? `${entries[entries.length - 1].date} — ${entries[0].date}` : "";
  if (dateRange) {
    doc.text(dateRange, pageWidth / 2, 80, { align: "center" });
  }

  doc.setFontSize(9);
  doc.text(`Exported ${new Date().toLocaleString(getLocale(language))}`, pageWidth / 2, 95, {
    align: "center",
  });

  // Entries
  onProgress?.("Generating pages...");
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    doc.addPage();
    y = margin;

    // Date header
    const dt = new Date(entry.createdAt);
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
      doc.text(`Mood: ${MOOD_LABEL[entry.mood] || entry.mood}`, margin, y);
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
    if (entry.tags.length > 0) {
      checkPage(6);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 220);
      doc.text(`Tags: ${entry.tags.map((t) => "#" + t).join(" ")}`, margin, y);
      y += 5;
    }

    // Photos embedded
    if (entry.photoIds.length > 0) {
      onProgress?.(`Loading photos for entry ${i + 1}...`);
      const photos = await storage.getPhotosForEntry(entry.id);
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

  const dateStr = getToday();
  doc.save(`journal-${dateStr}.pdf`);
}
