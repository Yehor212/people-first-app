import { startTransition, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { JournalEntry, JournalPhoto, JournalAudio } from './types';
import type { JournalDraftCommitContext, JournalEntryPageCursor } from './journalStorage';
import type { MoodType } from '@/types';
import { getToday } from '@/lib/utils';
import { shiftJournalDate } from './journalDateUtils';
import { scheduleIdle, type IdleHandle } from '@/lib/scheduleIdle';
import * as storage from './journalStorage';
import { logger } from '@/lib/logger';
import { subscribeDataRefresh } from '@/hooks/useIndexedDB';
import {
  registerAccountBoundaryRuntimeReset,
  subscribeOriginAccountBoundaryGeneration,
  waitForAccountBoundaryDataSettlement,
} from '@/storage/accountBoundaryRuntime';

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
  const [selectedDate, setSelectedDateState] = useState<string | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [activeEntrySnapshot, setActiveEntrySnapshot] = useState<JournalEntry | null>(null);
  const [view, setView] = useState<JournalView>('list');
  const activeEntryIdRef = useRef<string | null>(null);
  const activeEntrySnapshotRef = useRef<JournalEntry | null>(null);
  const viewRef = useRef<JournalView>('list');
  const idleLoadRef = useRef<IdleHandle | null>(null);
  const loadGenerationRef = useRef(0);
  const mutationGenerationRef = useRef(0);
  const requestedDateLoadsRef = useRef(new Set<string>());
  const loadedDateLoadsRef = useRef(new Set<string>());
  const softDeletedEntryIdsRef = useRef(new Set<string>());
  // Only the initial page can make the diary unusable. Background/history failures
  // remain retryable without replacing entries that are already visible.
  const loadError = initialLoadError;

  const setSelectedDate = useCallback((date: string | null) => {
    setDateLoadError(false);
    setSelectedDateState(date);
  }, []);

  const cancelRemainingLoad = useCallback(() => {
    idleLoadRef.current?.cancel();
    idleLoadRef.current = null;
  }, []);

  const invalidateInFlightLoads = useCallback(() => {
    loadGenerationRef.current += 1;
    mutationGenerationRef.current += 1;
    requestedDateLoadsRef.current.clear();
    cancelRemainingLoad();
    setHistoryLoading(false);
  }, [cancelRemainingLoad]);

  const resetForAccountBoundary = useCallback(() => {
    invalidateInFlightLoads();
    softDeletedEntryIdsRef.current.clear();
    loadedDateLoadsRef.current.clear();
    setEntries([]);
    setTotalCount(0);
    setInitialLoadError(false);
    setHistoryLoadError(false);
    setDateLoadError(false);
    setSelectedDateState(null);
    setActiveEntryId(null);
    activeEntryIdRef.current = null;
    setActiveEntrySnapshot(null);
    activeEntrySnapshotRef.current = null;
    setView('list');
    viewRef.current = 'list';
    setLoading(true);
  }, [invalidateInFlightLoads]);

  const scheduleRemainingLoad = useCallback(
    (
      cursor: JournalEntryPageCursor | null,
      generation = loadGenerationRef.current,
      mutationGeneration = mutationGenerationRef.current,
    ) => {
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
            if (loadGenerationRef.current !== generation || mutationGenerationRef.current !== mutationGeneration) return;
            startTransition(() => {
              setEntries((prev) => mergeJournalEntries(prev, page.entries, softDeletedEntryIdsRef.current));
              setTotalCount((prev) => Math.max(
                prev,
                getVisibleJournalCount(page.totalCount, softDeletedEntryIdsRef.current.size),
              ));
              setHistoryLoadError(false);
            });
            if (page.hasMore && page.nextCursor !== null) {
              scheduleRemainingLoad(page.nextCursor, generation, mutationGeneration);
            } else {
              setHistoryLoading(false);
            }
          })
          .catch((error) => {
            if (loadGenerationRef.current !== generation || mutationGenerationRef.current !== mutationGeneration) return;
            logger.warn('[Journal] Failed to load older entries', error);
            setHistoryLoadError(true);
            setHistoryLoading(false);
          });
      }, 1200, 160);
    },
    [],
  );

  // Load the first journal page quickly, then backfill older encrypted entries in idle slices.
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
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
    const activeEntryIdAtStart = activeEntryIdRef.current;
    const activeViewAtStart = viewRef.current;
    const abortRefreshOwnership = () => {
      if (loadGenerationRef.current !== generation) return;
      loadGenerationRef.current += 1;
      cancelRemainingLoad();
      setLoading(false);
      setHistoryLoading(false);
    };
    signal?.addEventListener('abort', abortRefreshOwnership, { once: true });
    try {
      const [page, pendingDeletes, refreshedActiveEntry] = await Promise.all([
        storage.getEntriesPage({ limit: JOURNAL_INITIAL_ENTRY_LIMIT }),
        storage.getPendingJournalEntryDeletes(),
        activeEntryIdAtStart
          ? storage.getEntryById(activeEntryIdAtStart)
          : Promise.resolve(undefined),
      ]);
      if (signal?.aborted || loadGenerationRef.current !== generation) return;
      for (const pendingDelete of pendingDeletes) {
        softDeletedEntryIdsRef.current.add(pendingDelete.id);
      }
      if (signal?.aborted || loadGenerationRef.current !== generation) return;
      const activeEntryStillVisible =
        refreshedActiveEntry && !softDeletedEntryIdsRef.current.has(refreshedActiveEntry.id)
          ? refreshedActiveEntry
          : undefined;
      startTransition(() => {
        const refreshedEntries = mergeJournalEntries([], page.entries, softDeletedEntryIdsRef.current);
        setEntries(
          activeEntryStillVisible
            ? mergeJournalEntries(
                refreshedEntries,
                [activeEntryStillVisible],
                softDeletedEntryIdsRef.current,
              )
            : refreshedEntries,
        );
        setTotalCount(getVisibleJournalCount(page.totalCount, softDeletedEntryIdsRef.current.size));
        setInitialLoadError(false);
        setLoading(false);

        if (
          activeEntryIdAtStart &&
          activeEntryIdRef.current === activeEntryIdAtStart &&
          viewRef.current === activeViewAtStart
        ) {
          if (activeViewAtStart === 'viewing') {
            if (activeEntryStillVisible) {
              activeEntrySnapshotRef.current = activeEntryStillVisible;
              setActiveEntrySnapshot(activeEntryStillVisible);
            } else {
              activeEntryIdRef.current = null;
              setActiveEntryId(null);
              activeEntrySnapshotRef.current = null;
              setActiveEntrySnapshot(null);
              viewRef.current = 'list';
              setView('list');
            }
          } else if (
            activeViewAtStart === 'editing' &&
            !activeEntrySnapshotRef.current &&
            activeEntryStillVisible
          ) {
            activeEntrySnapshotRef.current = activeEntryStillVisible;
            setActiveEntrySnapshot(activeEntryStillVisible);
          }
        }
      });
      if (page.hasMore && page.nextCursor !== null) {
        if (signal?.aborted || loadGenerationRef.current !== generation) return;
        scheduleRemainingLoad(page.nextCursor, generation, mutationGenerationRef.current);
      }
    } catch (error) {
      if (signal?.aborted) return;
      logger.warn('[Journal] Failed to load entries', error);
      if (loadGenerationRef.current !== generation) return;
      startTransition(() => {
        setInitialLoadError(true);
        setLoading(false);
        setHistoryLoading(false);
      });
    } finally {
      signal?.removeEventListener('abort', abortRefreshOwnership);
    }
  }, [cancelRemainingLoad, scheduleRemainingLoad]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => subscribeDataRefresh(refresh), [refresh]);

  useEffect(() => {
    const unregisterRuntimeReset = registerAccountBoundaryRuntimeReset(resetForAccountBoundary);
    const unsubscribeGeneration = subscribeOriginAccountBoundaryGeneration(() => {
      resetForAccountBoundary();
      void waitForAccountBoundaryDataSettlement()
        .then(() => refresh())
        .catch((error) => {
          logger.warn('[Journal] Account-boundary refresh remained blocked', error);
        });
    });
    return () => {
      unsubscribeGeneration();
      unregisterRuntimeReset();
    };
  }, [refresh, resetForAccountBoundary]);

  useEffect(() => () => {
    loadGenerationRef.current += 1;
    cancelRemainingLoad();
  }, [cancelRemainingLoad]);

  useEffect(() => {
    if (!selectedDate || loading) return;
    const requestedDateLoads = requestedDateLoadsRef.current;
    const loadedDateLoads = loadedDateLoadsRef.current;
    if (loadedDateLoads.has(selectedDate) || requestedDateLoads.has(selectedDate)) return;

    requestedDateLoads.add(selectedDate);
    let cancelled = false;
    const mutationGeneration = mutationGenerationRef.current;
    void storage.getEntriesByDate(selectedDate).then((dateEntries) => {
      requestedDateLoads.delete(selectedDate);
      if (cancelled || mutationGenerationRef.current !== mutationGeneration) return;
      loadedDateLoads.add(selectedDate);
      startTransition(() => {
        setEntries((prev) => mergeJournalEntries(prev, dateEntries, softDeletedEntryIdsRef.current));
        setDateLoadError(false);
      });
    }).catch((error) => {
      requestedDateLoads.delete(selectedDate);
      if (cancelled || mutationGenerationRef.current !== mutationGeneration) return;
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
    const yesterdayStr = shiftJournalDate(today, -1);
    const weekStart = shiftJournalDate(today, -6);

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
      } else if (entry.date >= weekStart && entry.date <= today) {
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
  const createEntry = useCallback(async (
    data: CreateJournalEntryInput,
    draftContext?: JournalDraftCommitContext,
    requiredSpaceIds: readonly string[] = [],
  ) => {
    const { date, ...entryData } = data;
    const entryPayload = {
      ...entryData,
      date: date || getToday(),
    };
    const entry =
      draftContext || requiredSpaceIds.length > 0
        ? await storage.saveEntry(entryPayload, draftContext, requiredSpaceIds)
        : await storage.saveEntry(entryPayload);
    softDeletedEntryIdsRef.current.delete(entry.id);
    setEntries(prev => mergeJournalEntries(prev, [entry], softDeletedEntryIdsRef.current));
    setTotalCount(prev => prev + 1);
    return entry;
  }, []);

  const updateEntry = useCallback(async (
    id: string,
    changes: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>,
    draftContext?: JournalDraftCommitContext,
  ) => {
    const openedEditorEntry =
      viewRef.current === 'editing' && activeEntryIdRef.current === id
        ? activeEntrySnapshotRef.current
        : null;
    const expectedUpdatedAt =
      openedEditorEntry?.updatedAt ?? entries.find((entry) => entry.id === id)?.updatedAt;
    try {
      const updatedAt = draftContext
        ? await storage.updateEntry(id, changes, expectedUpdatedAt, draftContext)
        : await storage.updateEntry(id, changes, expectedUpdatedAt);
      setEntries(prev => prev.map(e =>
        e.id === id ? { ...e, ...changes, updatedAt } : e
      ));
      if (activeEntryIdRef.current === id && activeEntrySnapshotRef.current) {
        const nextSnapshot = { ...activeEntrySnapshotRef.current, ...changes, updatedAt };
        activeEntrySnapshotRef.current = nextSnapshot;
        setActiveEntrySnapshot(nextSnapshot);
      }
    } catch (error) {
      if (storage.isJournalEntryConflictError(error)) {
        try {
          const latest = await storage.getEntryById(id);
          if (latest) {
            setEntries((prev) => mergeJournalEntries(prev, [latest], softDeletedEntryIdsRef.current));
            if (viewRef.current === 'editing' && activeEntryIdRef.current === id) {
              activeEntrySnapshotRef.current = latest;
              setActiveEntrySnapshot(latest);
            }
          }
        } catch (refreshError) {
          logger.warn('[Journal] Failed to refresh entry after save conflict', refreshError);
        }
      }
      throw error;
    }
  }, [entries]);

  const deleteEntry = useCallback(async (id: string) => {
    softDeletedEntryIdsRef.current.add(id);
    try {
      await storage.deleteEntry(id);
      invalidateInFlightLoads();
    } finally {
      softDeletedEntryIdsRef.current.delete(id);
    }
    setEntries(prev => prev.filter(e => e.id !== id));
    setTotalCount(prev => Math.max(0, prev - 1));
    if (activeEntryId === id) {
      setActiveEntryId(null);
      activeEntryIdRef.current = null;
      setActiveEntrySnapshot(null);
      activeEntrySnapshotRef.current = null;
      setView('list');
      viewRef.current = 'list';
    }
  }, [activeEntryId, invalidateInFlightLoads]);

  // Soft delete: remove from UI state only, return entry for undo
  const softDeleteEntry = useCallback((id: string): JournalEntry | null => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return null;
    softDeletedEntryIdsRef.current.add(id);
    setEntries(prev => prev.filter(e => e.id !== id));
    setTotalCount(prev => Math.max(0, prev - 1));
    if (activeEntryId === id) {
      setActiveEntryId(null);
      activeEntryIdRef.current = null;
      setActiveEntrySnapshot(null);
      activeEntrySnapshotRef.current = null;
      setView('list');
      viewRef.current = 'list';
    }
    return entry;
  }, [entries, activeEntryId]);

  // Commit: actually delete from storage (called after undo timeout)
  const commitDeleteEntry = useCallback(async (id: string) => {
    try {
      const status = await storage.commitPendingJournalEntryDelete(id);
      if (status === "not-claimed") {
        softDeletedEntryIdsRef.current.delete(id);
        const [retainedEntry, storedCount] = await Promise.all([
          storage.getEntryById(id),
          storage.getEntryCount(),
        ]);
        if (retainedEntry) {
          setEntries((prev) => mergeJournalEntries(prev, [retainedEntry], softDeletedEntryIdsRef.current));
        }
        setTotalCount(getVisibleJournalCount(storedCount, softDeletedEntryIdsRef.current.size));
        invalidateInFlightLoads();
        return;
      }
    } catch (error) {
      softDeletedEntryIdsRef.current.delete(id);
      throw error;
    }
    invalidateInFlightLoads();
    softDeletedEntryIdsRef.current.delete(id);
  }, [invalidateInFlightLoads]);

  // Restore: add entry back to UI state (on undo)
  const restoreEntry = useCallback((entry: JournalEntry) => {
    softDeletedEntryIdsRef.current.delete(entry.id);
    setEntries(prev => mergeJournalEntries(prev, [entry], softDeletedEntryIdsRef.current));
    setTotalCount(prev => prev + 1);
  }, []);

  // Photo operations
  const addPhoto = useCallback(async (
    file: File,
    entryId: string,
    signal?: AbortSignal,
  ): Promise<JournalPhoto> => {
    return storage.compressAndStorePhoto(file, entryId, signal);
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
    const entry = entries.find((candidate) => candidate.id === id) || null;
    activeEntrySnapshotRef.current = entry;
    setActiveEntrySnapshot(entry);
    activeEntryIdRef.current = id;
    setActiveEntryId(id);
    viewRef.current = 'viewing';
    setView('viewing');
  }, [entries]);

  const editEntry = useCallback((id: string | null) => {
    const entry = id
      ? activeEntryIdRef.current === id && activeEntrySnapshotRef.current
        ? activeEntrySnapshotRef.current
        : entries.find((candidate) => candidate.id === id) || null
      : null;
    activeEntrySnapshotRef.current = entry;
    setActiveEntrySnapshot(entry);
    activeEntryIdRef.current = id;
    setActiveEntryId(id);
    viewRef.current = 'editing';
    setView('editing');
  }, [entries]);

  const openStats = useCallback(() => {
    activeEntryIdRef.current = null;
    setActiveEntryId(null);
    activeEntrySnapshotRef.current = null;
    setActiveEntrySnapshot(null);
    viewRef.current = 'stats';
    setView('stats');
  }, []);

  const goBack = useCallback(() => {
    if (view === 'editing' || view === 'viewing' || view === 'stats') {
      activeEntryIdRef.current = null;
      setActiveEntryId(null);
      activeEntrySnapshotRef.current = null;
      setActiveEntrySnapshot(null);
      viewRef.current = 'list';
      setView('list');
    }
  }, [view]);

  const activeEntry = useMemo(() => {
    if (!activeEntryId) return null;
    return activeEntrySnapshot?.id === activeEntryId
      ? activeEntrySnapshot
      : entries.find(e => e.id === activeEntryId) || null;
  }, [activeEntryId, activeEntrySnapshot, entries]);

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
