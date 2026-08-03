import Dexie from "dexie";
import { db } from "@/storage/db";
import { logger } from "@/lib/logger";

export const DELETION_TRACKER_KEYS = {
  habit: "zenflow-deleted-habit-ids",
  journal: "zenflow-deleted-journal-entry-ids",
  mood: "zenflow-deleted-mood-ids",
  focus: "zenflow-deleted-focus-session-ids",
  gratitude: "zenflow-deleted-gratitude-ids",
} as const;

export type DeletionTrackerKey =
  (typeof DELETION_TRACKER_KEYS)[keyof typeof DELETION_TRACKER_KEYS];

export function getDeletionTrackerKeyForSyncEntity(entityType: string): string | null {
  return (DELETION_TRACKER_KEYS as Partial<Record<string, string>>)[entityType] ?? null;
}

// Synchronous in-flight guard: a caller may start tracking a deletion and then
// immediately trigger a cloud merge before the IndexedDB write commits. Keep the
// id visible to readers during that window so stale backups cannot resurrect it.
const inFlightDeletedIds = new Map<string, Set<string>>();

function rememberInFlightDeletedId(key: string, id: string): void {
  let ids = inFlightDeletedIds.get(key);
  if (!ids) {
    ids = new Set<string>();
    inFlightDeletedIds.set(key, ids);
  }
  ids.add(id);
}

function forgetInFlightDeletedIds(key: string, idsToForget: string[]): void {
  const ids = inFlightDeletedIds.get(key);
  if (!ids) return;
  for (const id of idsToForget) {
    ids.delete(id);
  }
  if (ids.size === 0) {
    inFlightDeletedIds.delete(key);
  }
}

// Generic deletion tracking helpers

async function getDeletedIds(key: string): Promise<Set<string>> {
  const inFlight = inFlightDeletedIds.get(key);
  try {
    const entry = await db.settings.get(key);
    const persisted = entry?.value && Array.isArray(entry.value) ? (entry.value as string[]) : [];
    return new Set([...(inFlight ?? []), ...persisted]);
  } catch (error) {
    logger.error(`[DeletionTracker] Failed to read ${key}:`, error);
    throw error;
  }
}

/**
 * Deleted IDs are permanent local tombstones.
 * Do not evict old IDs: stale backups and delayed pulls must never resurrect data.
 */
export function normalizeDeletedIdsForStorage(ids: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

/**
 * Merge tombstones into the current Dexie read-write transaction.
 *
 * Backup import uses this seam so tracker persistence, imported rows, and the
 * final owner check share one commit boundary. In-flight IDs stay visible to
 * concurrent readers until that transaction completes or aborts.
 */
export async function mergeDeletionTrackerIdsInCurrentTransaction(
  key: DeletionTrackerKey,
  remoteIds: string[],
): Promise<Set<string>> {
  const transaction = Dexie.currentTransaction;
  if (!transaction || transaction.mode !== "readwrite") {
    throw new Error("Deletion tracker merge requires an active read-write transaction");
  }

  const idsToMerge = normalizeDeletedIdsForStorage(remoteIds);
  for (const id of idsToMerge) {
    rememberInFlightDeletedId(key, id);
  }

  try {
    const entry = await db.settings.get(key);
    const persisted = entry?.value && Array.isArray(entry.value)
      ? (entry.value as string[])
      : [];
    const existing = new Set([...(inFlightDeletedIds.get(key) ?? []), ...persisted]);

    if (idsToMerge.length) {
      await db.settings.put({ key, value: normalizeDeletedIdsForStorage([...existing]) });

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        forgetInFlightDeletedIds(key, idsToMerge);
      };
      transaction.on("complete", cleanup);
      transaction.on("abort", cleanup);
    }

    return existing;
  } catch (error) {
    forgetInFlightDeletedIds(key, idsToMerge);
    logger.error(`[DeletionTracker] Failed to merge ${key}:`, error);
    throw error;
  }
}

async function mergeDeletedIds(key: DeletionTrackerKey, remoteIds: string[]): Promise<void> {
  const idsToMerge = normalizeDeletedIdsForStorage(remoteIds);
  if (!idsToMerge.length) return;
  for (const id of idsToMerge) {
    rememberInFlightDeletedId(key, id);
  }
  try {
    await db.transaction("rw", db.settings, () =>
      mergeDeletionTrackerIdsInCurrentTransaction(key, idsToMerge),
    );
  } catch (error) {
    forgetInFlightDeletedIds(key, idsToMerge);
    throw error;
  }
}

async function trackDeletedId(key: DeletionTrackerKey, id: string): Promise<void> {
  await mergeDeletedIds(key, [id]);
}

// Habit deletion tracking

const DELETED_HABITS_KEY = DELETION_TRACKER_KEYS.habit;

export const trackDeletedHabitId = (id: string) => trackDeletedId(DELETED_HABITS_KEY, id);
export const getDeletedHabitIds = () => getDeletedIds(DELETED_HABITS_KEY);
export const mergeDeletedHabitIds = (ids: string[]) => mergeDeletedIds(DELETED_HABITS_KEY, ids);

// Journal entry deletion tracking

const DELETED_JOURNAL_ENTRIES_KEY = DELETION_TRACKER_KEYS.journal;

export const trackDeletedJournalEntryId = (id: string) =>
  trackDeletedId(DELETED_JOURNAL_ENTRIES_KEY, id);
export const getDeletedJournalEntryIds = () => getDeletedIds(DELETED_JOURNAL_ENTRIES_KEY);
export const mergeDeletedJournalEntryIds = (ids: string[]) =>
  mergeDeletedIds(DELETED_JOURNAL_ENTRIES_KEY, ids);

// Mood deletion tracking

const DELETED_MOODS_KEY = DELETION_TRACKER_KEYS.mood;

export const trackDeletedMoodId = (id: string) => trackDeletedId(DELETED_MOODS_KEY, id);
export const getDeletedMoodIds = () => getDeletedIds(DELETED_MOODS_KEY);
export const mergeDeletedMoodIds = (ids: string[]) => mergeDeletedIds(DELETED_MOODS_KEY, ids);

// Focus session deletion tracking

const DELETED_FOCUS_SESSIONS_KEY = DELETION_TRACKER_KEYS.focus;

export const trackDeletedFocusSessionId = (id: string) =>
  trackDeletedId(DELETED_FOCUS_SESSIONS_KEY, id);
export const getDeletedFocusSessionIds = () => getDeletedIds(DELETED_FOCUS_SESSIONS_KEY);
export const mergeDeletedFocusSessionIds = (ids: string[]) =>
  mergeDeletedIds(DELETED_FOCUS_SESSIONS_KEY, ids);

// Gratitude entry deletion tracking

const DELETED_GRATITUDE_KEY = DELETION_TRACKER_KEYS.gratitude;

export const trackDeletedGratitudeId = (id: string) => trackDeletedId(DELETED_GRATITUDE_KEY, id);
export const getDeletedGratitudeIds = () => getDeletedIds(DELETED_GRATITUDE_KEY);
export const mergeDeletedGratitudeIds = (ids: string[]) =>
  mergeDeletedIds(DELETED_GRATITUDE_KEY, ids);
