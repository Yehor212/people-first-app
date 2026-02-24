/**
 * useDiaryPersistence — Save/load diary entries via IndexedDB (settingsRepo).
 *
 * Strategy:
 * - Primary save trigger: explicit save() call (on close / on blur)
 * - Safety net: debounced auto-save every 30s during editing
 * - Images stored as separate array (never embedded in HTML)
 * - Hydration safety: MutationObserver (Guardrail 2) auto-cleans orphaned
 *   widgetStates after HTML is loaded into contenteditable
 *
 * Storage keys:
 * - 'diary-entries'  → DiaryEntry[] (metadata + htmlContent + widgetStates)
 * - 'diary-images-{entryId}' → ImageData[] (base64 stored per-entry)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';
import type { DiaryEntry, DiaryThemeName, DiaryFontName, WidgetState } from '../types';
import type { ImageInfo } from './useDiaryImages';

const ENTRIES_KEY = 'diary-entries';
const imagesKey = (entryId: string) => `diary-images-${entryId}`;
const AUTOSAVE_DELAY = 30_000; // 30 seconds

/** Minimal image data persisted to IndexedDB (no position — recalculated on load) */
interface PersistedImage {
  id: string;
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  scale: number;
}

export interface DiaryPersistenceReturn {
  currentEntryId: string | null;
  entries: DiaryEntry[];
  loading: boolean;
  /** Load all entries (metadata only, no images) */
  loadEntries: () => Promise<void>;
  /** Load a specific entry's full data (HTML + images) into the editor */
  loadEntry: (id: string) => Promise<{ html: string; images: PersistedImage[]; widgetStates: Record<string, WidgetState>; theme: DiaryThemeName; font: DiaryFontName } | null>;
  /** Save current editor state */
  save: (data: {
    id: string | null;
    htmlContent: string;
    plainText: string;
    wordCount: number;
    theme: DiaryThemeName;
    font: DiaryFontName;
    widgetStates: Record<string, WidgetState>;
    images: ImageInfo[];
  }) => Promise<string>;
  /** Delete an entry */
  deleteEntry: (id: string) => Promise<void>;
  /** Schedule debounced auto-save (call on every content change) */
  scheduleSave: () => void;
  /** Cancel pending auto-save (call on unmount) */
  cancelPendingSave: () => void;
}

async function getSettingsRepo() {
  const { settingsRepo } = await import('@/storage/db');
  return settingsRepo;
}

async function loadAllEntries(): Promise<DiaryEntry[]> {
  try {
    const repo = await getSettingsRepo();
    const record = await repo.get(ENTRIES_KEY);
    if (!record?.value) return [];
    return record.value as DiaryEntry[];
  } catch (err) {
    logger.warn('[DiaryPersistence] Failed to load entries:', err);
    return [];
  }
}

async function saveAllEntries(entries: DiaryEntry[]): Promise<void> {
  const repo = await getSettingsRepo();
  await repo.put({ key: ENTRIES_KEY, value: entries });
}

async function loadEntryImages(entryId: string): Promise<PersistedImage[]> {
  try {
    const repo = await getSettingsRepo();
    const record = await repo.get(imagesKey(entryId));
    if (!record?.value) return [];
    return record.value as PersistedImage[];
  } catch (err) {
    logger.warn('[DiaryPersistence] Failed to load images:', err);
    return [];
  }
}

async function saveEntryImages(entryId: string, images: ImageInfo[]): Promise<void> {
  const repo = await getSettingsRepo();
  const persisted: PersistedImage[] = images.map(img => ({
    id: img.id,
    src: img.src,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    scale: img.scale,
  }));
  await repo.put({ key: imagesKey(entryId), value: persisted });
}

async function deleteEntryImages(entryId: string): Promise<void> {
  try {
    const repo = await getSettingsRepo();
    await repo.delete(imagesKey(entryId));
  } catch {
    // Non-critical — orphaned image data will be overwritten on next save
  }
}

export function useDiaryPersistence(): DiaryPersistenceReturn {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const autoSaveTimerRef = useRef(0);
  const pendingSaveRef = useRef<(() => Promise<string>) | null>(null);

  // ── Load all entries (list view) ──
  const loadEntries = useCallback(async () => {
    setLoading(true);
    const all = await loadAllEntries();
    setEntries(all.sort((a, b) => b.updatedAt - a.updatedAt));
    setLoading(false);
  }, []);

  // ── Load single entry for editing ──
  const loadEntry = useCallback(async (id: string) => {
    const all = await loadAllEntries();
    const entry = all.find(e => e.id === id);
    if (!entry) return null;

    setCurrentEntryId(id);
    const images = await loadEntryImages(id);

    return {
      html: entry.htmlContent,
      images,
      widgetStates: entry.widgetStates || {},
      theme: entry.theme,
      font: entry.font,
    };
  }, []);

  // ── Save entry ──
  const save = useCallback(async (data: {
    id: string | null;
    htmlContent: string;
    plainText: string;
    wordCount: number;
    theme: DiaryThemeName;
    font: DiaryFontName;
    widgetStates: Record<string, WidgetState>;
    images: ImageInfo[];
  }): Promise<string> => {
    const all = await loadAllEntries();
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    let entryId: string;

    if (data.id) {
      // Update existing
      entryId = data.id;
      const idx = all.findIndex(e => e.id === entryId);
      if (idx >= 0) {
        all[idx] = {
          ...all[idx],
          htmlContent: data.htmlContent,
          plainText: data.plainText,
          wordCount: data.wordCount,
          theme: data.theme,
          font: data.font,
          widgetStates: data.widgetStates,
          imageIds: data.images.map(img => img.id),
          updatedAt: now,
        };
      }
    } else {
      // Create new
      entryId = `diary-${now}-${Math.random().toString(36).slice(2, 8)}`;
      all.push({
        id: entryId,
        date: today,
        htmlContent: data.htmlContent,
        plainText: data.plainText,
        theme: data.theme,
        font: data.font,
        widgetStates: data.widgetStates,
        imageIds: data.images.map(img => img.id),
        wordCount: data.wordCount,
        createdAt: now,
        updatedAt: now,
      });
    }

    await saveAllEntries(all);
    await saveEntryImages(entryId, data.images);

    setCurrentEntryId(entryId);
    setEntries(all.sort((a, b) => b.updatedAt - a.updatedAt));

    logger.log(`[DiaryPersistence] Saved entry ${entryId} (${data.wordCount} words, ${data.images.length} images)`);
    return entryId;
  }, []);

  // ── Delete entry ──
  const deleteEntry = useCallback(async (id: string) => {
    const all = await loadAllEntries();
    const filtered = all.filter(e => e.id !== id);
    await saveAllEntries(filtered);
    await deleteEntryImages(id);
    setEntries(filtered.sort((a, b) => b.updatedAt - a.updatedAt));
    if (currentEntryId === id) setCurrentEntryId(null);
  }, [currentEntryId]);

  // ── Debounced auto-save ──
  const scheduleSave = useCallback(() => {
    window.clearTimeout(autoSaveTimerRef.current);
    if (pendingSaveRef.current) {
      autoSaveTimerRef.current = window.setTimeout(() => {
        void pendingSaveRef.current?.();
      }, AUTOSAVE_DELAY);
    }
  }, []);

  const cancelPendingSave = useCallback(() => {
    window.clearTimeout(autoSaveTimerRef.current);
    pendingSaveRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => window.clearTimeout(autoSaveTimerRef.current);
  }, []);

  return {
    currentEntryId,
    entries,
    loading,
    loadEntries,
    loadEntry,
    save,
    deleteEntry,
    scheduleSave,
    cancelPendingSave,
  };
}
