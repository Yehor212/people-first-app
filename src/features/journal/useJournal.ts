import { useState, useEffect, useCallback, useMemo } from 'react';
import type { JournalEntry, JournalPhoto, JournalAudio } from './types';
import type { MoodType } from '@/types';
import { getToday } from '@/lib/utils';
import * as storage from './journalStorage';

export type JournalView = 'list' | 'editing' | 'viewing' | 'stats';

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [view, setView] = useState<JournalView>('list');

  // Load all entries
  const refresh = useCallback(async () => {
    try {
      const all = await storage.getAllEntries();
      setEntries(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Filtered entries by selected date
  const filteredEntries = useMemo(() => {
    if (!selectedDate) return entries;
    return entries.filter(e => e.date === selectedDate);
  }, [entries, selectedDate]);

  // Grouped entries for display
  const groupedEntries = useMemo(() => {
    const today = getToday();
    const yesterday = new Date(Date.now() - 86400000);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const weekAgo = Date.now() - 7 * 86400000;

    const groups: { label: string; key: string; entries: JournalEntry[] }[] = [
      { label: 'journalToday', key: 'today', entries: [] },
      { label: 'journalYesterday', key: 'yesterday', entries: [] },
      { label: 'journalThisWeek', key: 'week', entries: [] },
      { label: 'journalEarlier', key: 'earlier', entries: [] },
    ];

    for (const entry of filteredEntries) {
      if (entry.date === today) {
        groups[0].entries.push(entry);
      } else if (entry.date === yesterdayStr) {
        groups[1].entries.push(entry);
      } else if (entry.createdAt >= weekAgo) {
        groups[2].entries.push(entry);
      } else {
        groups[3].entries.push(entry);
      }
    }

    return groups.filter(g => g.entries.length > 0);
  }, [filteredEntries]);

  // Dates that have entries (for calendar dots)
  const entryDates = useMemo(() => {
    const map = new Map<string, MoodType | undefined>();
    for (const e of entries) {
      if (!map.has(e.date)) map.set(e.date, e.mood);
    }
    return map;
  }, [entries]);

  // CRUD operations
  const createEntry = useCallback(async (data: {
    title: string;
    content: string;
    stickers: string[];
    photoIds: string[];
    audioIds?: string[];
    mood?: MoodType;
    tags: string[];
    date?: string;
  }) => {
    const entry = await storage.saveEntry({
      date: data.date || getToday(),
      title: data.title,
      content: data.content,
      stickers: data.stickers,
      photoIds: data.photoIds,
      mood: data.mood,
      tags: data.tags,
    });
    setEntries(prev => [entry, ...prev]);
    return entry;
  }, []);

  const updateEntry = useCallback(async (id: string, changes: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>) => {
    await storage.updateEntry(id, changes);
    setEntries(prev => prev.map(e =>
      e.id === id ? { ...e, ...changes, updatedAt: Date.now() } : e
    ));
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    await storage.deleteEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
    if (activeEntryId === id) {
      setActiveEntryId(null);
      setView('list');
    }
  }, [activeEntryId]);

  // Soft delete: remove from UI state only, return entry for undo
  const softDeleteEntry = useCallback((id: string): JournalEntry | null => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return null;
    setEntries(prev => prev.filter(e => e.id !== id));
    if (activeEntryId === id) {
      setActiveEntryId(null);
      setView('list');
    }
    return entry;
  }, [entries, activeEntryId]);

  // Commit: actually delete from storage (called after undo timeout)
  const commitDeleteEntry = useCallback(async (id: string) => {
    await storage.deleteEntry(id);
  }, []);

  // Restore: add entry back to UI state (on undo)
  const restoreEntry = useCallback((entry: JournalEntry) => {
    setEntries(prev => [entry, ...prev].sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  // Photo operations
  const addPhoto = useCallback(async (file: File, entryId: string): Promise<JournalPhoto> => {
    return storage.compressAndStorePhoto(file, entryId);
  }, []);

  const removePhoto = useCallback(async (photoId: string, entryId: string) => {
    await storage.deletePhoto(photoId, entryId);
  }, []);

  const getPhotos = useCallback(async (entryId: string): Promise<JournalPhoto[]> => {
    return storage.getPhotosForEntry(entryId);
  }, []);

  // Audio operations
  const addAudio = useCallback(async (data: string, duration: number, mimeType: string, entryId: string): Promise<JournalAudio> => {
    return storage.storeAudio(entryId, data, duration, mimeType);
  }, []);

  const removeAudio = useCallback(async (audioId: string, entryId: string) => {
    await storage.deleteAudio(audioId, entryId);
  }, []);

  const getAudio = useCallback(async (entryId: string): Promise<JournalAudio[]> => {
    return storage.getAudioForEntry(entryId);
  }, []);

  // Navigation
  const openEntry = useCallback((id: string) => {
    setActiveEntryId(id);
    setView('viewing');
  }, []);

  const editEntry = useCallback((id: string | null) => {
    setActiveEntryId(id);
    setView('editing');
  }, []);

  const openStats = useCallback(() => {
    setView('stats');
  }, []);

  const goBack = useCallback(() => {
    if (view === 'editing' || view === 'viewing' || view === 'stats') {
      setActiveEntryId(null);
      setView('list');
    }
  }, [view]);

  const activeEntry = useMemo(() => {
    if (!activeEntryId) return null;
    return entries.find(e => e.id === activeEntryId) || null;
  }, [entries, activeEntryId]);

  return {
    entries: filteredEntries,
    allEntries: entries,
    groupedEntries,
    entryDates,
    loading,
    view,
    activeEntry,
    activeEntryId,
    selectedDate,
    setSelectedDate,
    createEntry,
    updateEntry,
    deleteEntry,
    softDeleteEntry,
    commitDeleteEntry,
    restoreEntry,
    addPhoto,
    removePhoto,
    getPhotos,
    addAudio,
    removeAudio,
    getAudio,
    openEntry,
    editEntry,
    openStats,
    goBack,
    refresh,
    totalCount: entries.length,
  };
}
