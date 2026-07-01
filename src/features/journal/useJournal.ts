import { startTransition, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { JournalEntry, JournalPhoto, JournalAudio } from './types';
import type { JournalEntryPageCursor } from './journalStorage';
import type { MoodType } from '@/types';
import { getToday } from '@/lib/utils';
import { scheduleIdle, type IdleHandle } from '@/lib/scheduleIdle';
import * as storage from './journalStorage';
import { logger } from '@/lib/logger';

export type JournalView = 'list' | 'editing' | 'viewing' | 'stats';
type CreateJournalEntryInput = Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt' | 'date'> & {
  date?: string;
};

const JOURNAL_INITIAL_ENTRY_LIMIT = 32;
const JOURNAL_BACKGROUND_ENTRY_LIMIT = 32;

function compareJournalEntryIdsDescending(a: string, b: string): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

function mergeJournalEntries(
  current: JournalEntry[],
  incoming: JournalEntry[],
  excludedIds: ReadonlySet<string> = new Set(),
): JournalEntry[] {
  if (incoming.length === 0 && excludedIds.size === 0) return current;

  const byId = new Map<string, JournalEntry>();
  for (const entry of current) {
    if (!excludedIds.has(entry.id)) byId.set(entry.id, entry);
  }
  for (const entry of incoming) {
    if (!excludedIds.has(entry.id)) byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
    return compareJournalEntryIdsDescending(a.id, b.id);
  });
}

function getVisibleJournalCount(storedCount: number, hiddenCount: number): number {
  return Math.max(0, storedCount - hiddenCount);
}

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [initialLoadError, setInitialLoadError] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState(false);
  const [dateLoadError, setDateLoadError] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [view, setView] = useState<JournalView>('list');
  const idleLoadRef = useRef<IdleHandle | null>(null);
  const loadGenerationRef = useRef(0);
  const requestedDateLoadsRef = useRef(new Set<string>());
  const loadedDateLoadsRef = useRef(new Set<string>());
  const softDeletedEntryIdsRef = useRef(new Set<string>());
  const loadError = initialLoadError || historyLoadError || dateLoadError;

  const cancelRemainingLoad = useCallback(() => {
    idleLoadRef.current?.cancel();
    idleLoadRef.current = null;
  }, []);

  const scheduleRemainingLoad = useCallback(
    (cursor: JournalEntryPageCursor | null, generation = loadGenerationRef.current) => {
      if (cursor === null) {
        setHistoryLoading(false);
        return;
      }

      setHistoryLoading(true);
      idleLoadRef.current = scheduleIdle(() => {
        idleLoadRef.current = null;
        void storage
          .getEntriesPage({ limit: JOURNAL_BACKGROUND_ENTRY_LIMIT, before: cursor })
          .then((page) => {
            if (loadGenerationRef.current !== generation) return;
            startTransition(() => {
              setEntries((prev) => mergeJournalEntries(prev, page.entries, softDeletedEntryIdsRef.current));
              setTotalCount((prev) => Math.max(
                prev,
                getVisibleJournalCount(page.totalCount, softDeletedEntryIdsRef.current.size),
              ));
              setHistoryLoadError(false);
            });
            if (page.hasMore && page.nextCursor !== null) {
              scheduleRemainingLoad(page.nextCursor, generation);
            } else {
              setHistoryLoading(false);
            }
          })
          .catch((error) => {
            if (loadGenerationRef.current !== generation) return;
            logger.warn('[Journal] Failed to load older entries', error);
            setHistoryLoadError(true);
            setHistoryLoading(false);
          });
      }, 1200, 160);
    },
    [],
  );

  // Load the first journal page quickly, then backfill older encrypted entries in idle slices.
  const refresh = useCallback(async () => {
    cancelRemainingLoad();
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    requestedDateLoadsRef.current.clear();
    loadedDateLoadsRef.current.clear();
    setLoading(true);
    setHistoryLoading(false);
    setInitialLoadError(false);
    setHistoryLoadError(false);
    setDateLoadError(false);
    try {
      const page = await storage.getEntriesPage({ limit: JOURNAL_INITIAL_ENTRY_LIMIT });
      if (loadGenerationRef.current !== generation) return;
      startTransition(() => {
        setEntries(mergeJournalEntries([], page.entries, softDeletedEntryIdsRef.current));
        setTotalCount(getVisibleJournalCount(page.totalCount, softDeletedEntryIdsRef.current.size));
        setInitialLoadError(false);
        setLoading(false);
      });
      if (page.hasMore && page.nextCursor !== null) {
        scheduleRemainingLoad(page.nextCursor, generation);
      }
    } catch (error) {
      logger.warn('[Journal] Failed to load entries', error);
      if (loadGenerationRef.current !== generation) return;
      startTransition(() => {
        setInitialLoadError(true);
        setLoading(false);
        setHistoryLoading(false);
      });
    }
  }, [cancelRemainingLoad, scheduleRemainingLoad]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => () => {
    loadGenerationRef.current += 1;
    cancelRemainingLoad();
  }, [cancelRemainingLoad]);

  useEffect(() => {
    if (!selectedDate || loading) return;
    const requestedDateLoads = requestedDateLoadsRef.current;
    const loadedDateLoads = loadedDateLoadsRef.current;
    if (loadedDateLoads.has(selectedDate) || requestedDateLoads.has(selectedDate)) return;
    if (entries.some((entry) => entry.date === selectedDate)) {
      loadedDateLoads.add(selectedDate);
      setDateLoadError(false);
      return;
    }

    requestedDateLoads.add(selectedDate);
    let cancelled = false;
    void storage.getEntriesByDate(selectedDate).then((dateEntries) => {
      requestedDateLoads.delete(selectedDate);
      if (cancelled) return;
      loadedDateLoads.add(selectedDate);
      startTransition(() => {
        setEntries((prev) => mergeJournalEntries(prev, dateEntries, softDeletedEntryIdsRef.current));
        setDateLoadError(false);
      });
    }).catch((error) => {
      requestedDateLoads.delete(selectedDate);
      if (cancelled) return;
      loadedDateLoads.delete(selectedDate);
      logger.warn('[Journal] Failed to load selected date entries', error);
      setDateLoadError(true);
    });
    return () => {
      cancelled = true;
      requestedDateLoads.delete(selectedDate);
    };
  }, [entries, loading, selectedDate]);

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
  const createEntry = useCallback(async (data: CreateJournalEntryInput) => {
    const { date, ...entryData } = data;
    const entry = await storage.saveEntry({
      ...entryData,
      date: date || getToday(),
    });
    softDeletedEntryIdsRef.current.delete(entry.id);
    setEntries(prev => mergeJournalEntries(prev, [entry], softDeletedEntryIdsRef.current));
    setTotalCount(prev => prev + 1);
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
    softDeletedEntryIdsRef.current.delete(id);
    setEntries(prev => prev.filter(e => e.id !== id));
    setTotalCount(prev => Math.max(0, prev - 1));
    if (activeEntryId === id) {
      setActiveEntryId(null);
      setView('list');
    }
  }, [activeEntryId]);

  // Soft delete: remove from UI state only, return entry for undo
  const softDeleteEntry = useCallback((id: string): JournalEntry | null => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return null;
    softDeletedEntryIdsRef.current.add(id);
    setEntries(prev => prev.filter(e => e.id !== id));
    setTotalCount(prev => Math.max(0, prev - 1));
    if (activeEntryId === id) {
      setActiveEntryId(null);
      setView('list');
    }
    return entry;
  }, [entries, activeEntryId]);

  // Commit: actually delete from storage (called after undo timeout)
  const commitDeleteEntry = useCallback(async (id: string) => {
    await storage.deleteEntry(id);
    softDeletedEntryIdsRef.current.delete(id);
  }, []);

  // Restore: add entry back to UI state (on undo)
  const restoreEntry = useCallback((entry: JournalEntry) => {
    softDeletedEntryIdsRef.current.delete(entry.id);
    setEntries(prev => mergeJournalEntries(prev, [entry], softDeletedEntryIdsRef.current));
    setTotalCount(prev => prev + 1);
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
    historyLoading,
    historyLoadError,
    dateLoadError,
    loadError,
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
    totalCount,
  };
}
