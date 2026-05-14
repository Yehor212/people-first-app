import { db } from "@/storage/db";
import { logger } from "@/lib/logger";

// Max IDs per tracker — prevents unbounded growth over years of usage.
// IDs are appended in order, so oldest = first. When limit exceeded, oldest are pruned.
// 5000 IDs ≈ 200KB — safe for IndexedDB on all platforms.
export const MAX_TRACKER_IDS = 5000;

export const DELETION_TRACKER_KEYS = {
  habit: "zenflow-deleted-habit-ids",
  journal: "zenflow-deleted-journal-entry-ids",
  mood: "zenflow-deleted-mood-ids",
  focus: "zenflow-deleted-focus-session-ids",
  gratitude: "zenflow-deleted-gratitude-ids",
} as const;

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

// ── Generic deletion tracking helpers ──────────────────────────────────────────

async function getDeletedIds(key: string): Promise<Set<string>> {
  const inFlight = inFlightDeletedIds.get(key);
  try {
    const entry = await db.settings.get(key);
    const persisted = entry?.value && Array.isArray(entry.value) ? (entry.value as string[]) : [];
    return new Set([...(inFlight ?? []), ...persisted]);
  } catch (error) {
    logger.error(`[DeletionTracker] Failed to read ${key}:`, error);
    return new Set(inFlight ?? []);
  }
}

/** Prune oldest IDs when tracker exceeds MAX_TRACKER_IDS */
export function pruneDeletedIdsForStorage(ids: string[]): string[] {
  if (ids.length <= MAX_TRACKER_IDS) return ids;
  const pruneCount = ids.length - MAX_TRACKER_IDS;
  logger.log(`[DeletionTracker] Pruning ${pruneCount} oldest IDs (total: ${ids.length})`);
  return ids.slice(pruneCount);
}

async function trackDeletedId(key: string, id: string): Promise<void> {
  rememberInFlightDeletedId(key, id);
  try {
    await db.transaction("rw", db.settings, async () => {
      const existing = await getDeletedIds(key);
      existing.add(id);
      await db.settings.put({ key, value: pruneDeletedIdsForStorage([...existing]) });
    });
    forgetInFlightDeletedIds(key, [id]);
  } catch (error) {
    logger.error(`[DeletionTracker] Failed to track ${key}:`, error);
  }
}

async function mergeDeletedIds(key: string, remoteIds: string[]): Promise<void> {
  if (!remoteIds.length) return;
  for (const id of remoteIds) {
    rememberInFlightDeletedId(key, id);
  }
  try {
    await db.transaction("rw", db.settings, async () => {
      const existing = await getDeletedIds(key);
      for (const id of remoteIds) {
        existing.add(id);
      }
      await db.settings.put({ key, value: pruneDeletedIdsForStorage([...existing]) });
    });
    forgetInFlightDeletedIds(key, remoteIds);
  } catch (error) {
    logger.error(`[DeletionTracker] Failed to merge ${key}:`, error);
  }
}

// ── Habit deletion tracking ────────────────────────────────────────────────────

const DELETED_HABITS_KEY = DELETION_TRACKER_KEYS.habit;

export const trackDeletedHabitId = (id: string) => trackDeletedId(DELETED_HABITS_KEY, id);
export const getDeletedHabitIds = () => getDeletedIds(DELETED_HABITS_KEY);
export const mergeDeletedHabitIds = (ids: string[]) => mergeDeletedIds(DELETED_HABITS_KEY, ids);

// ── Journal entry deletion tracking ────────────────────────────────────────────

const DELETED_JOURNAL_ENTRIES_KEY = DELETION_TRACKER_KEYS.journal;

export const trackDeletedJournalEntryId = (id: string) =>
  trackDeletedId(DELETED_JOURNAL_ENTRIES_KEY, id);
export const getDeletedJournalEntryIds = () => getDeletedIds(DELETED_JOURNAL_ENTRIES_KEY);
export const mergeDeletedJournalEntryIds = (ids: string[]) =>
  mergeDeletedIds(DELETED_JOURNAL_ENTRIES_KEY, ids);

// ── Mood deletion tracking ────────────────────────────────────────────────────

const DELETED_MOODS_KEY = DELETION_TRACKER_KEYS.mood;

export const trackDeletedMoodId = (id: string) => trackDeletedId(DELETED_MOODS_KEY, id);
export const getDeletedMoodIds = () => getDeletedIds(DELETED_MOODS_KEY);
export const mergeDeletedMoodIds = (ids: string[]) => mergeDeletedIds(DELETED_MOODS_KEY, ids);

// ── Focus session deletion tracking ───────────────────────────────────────────

const DELETED_FOCUS_SESSIONS_KEY = DELETION_TRACKER_KEYS.focus;

export const trackDeletedFocusSessionId = (id: string) =>
  trackDeletedId(DELETED_FOCUS_SESSIONS_KEY, id);
export const getDeletedFocusSessionIds = () => getDeletedIds(DELETED_FOCUS_SESSIONS_KEY);
export const mergeDeletedFocusSessionIds = (ids: string[]) =>
  mergeDeletedIds(DELETED_FOCUS_SESSIONS_KEY, ids);

// ── Gratitude entry deletion tracking ─────────────────────────────────────────

const DELETED_GRATITUDE_KEY = DELETION_TRACKER_KEYS.gratitude;

export const trackDeletedGratitudeId = (id: string) => trackDeletedId(DELETED_GRATITUDE_KEY, id);
export const getDeletedGratitudeIds = () => getDeletedIds(DELETED_GRATITUDE_KEY);
export const mergeDeletedGratitudeIds = (ids: string[]) =>
  mergeDeletedIds(DELETED_GRATITUDE_KEY, ids);
