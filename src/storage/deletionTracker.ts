import { db } from "@/storage/db";
import { logger } from "@/lib/logger";

// ── Generic deletion tracking helpers ──────────────────────────────────────────

async function getDeletedIds(key: string): Promise<Set<string>> {
  try {
    const entry = await db.settings.get(key);
    if (!entry?.value || !Array.isArray(entry.value)) return new Set();
    return new Set(entry.value as string[]);
  } catch (error) {
    logger.error(`[DeletionTracker] Failed to read ${key}:`, error);
    return new Set();
  }
}

async function trackDeletedId(key: string, id: string): Promise<void> {
  try {
    await db.transaction("rw", db.settings, async () => {
      const existing = await getDeletedIds(key);
      existing.add(id);
      await db.settings.put({ key, value: [...existing] });
    });
  } catch (error) {
    logger.error(`[DeletionTracker] Failed to track ${key}:`, error);
  }
}

async function mergeDeletedIds(key: string, remoteIds: string[]): Promise<void> {
  if (!remoteIds.length) return;
  try {
    await db.transaction("rw", db.settings, async () => {
      const existing = await getDeletedIds(key);
      for (const id of remoteIds) {
        existing.add(id);
      }
      await db.settings.put({ key, value: [...existing] });
    });
  } catch (error) {
    logger.error(`[DeletionTracker] Failed to merge ${key}:`, error);
  }
}

// ── Habit deletion tracking ────────────────────────────────────────────────────

const DELETED_HABITS_KEY = "zenflow-deleted-habit-ids";

export const trackDeletedHabitId = (id: string) => trackDeletedId(DELETED_HABITS_KEY, id);
export const getDeletedHabitIds = () => getDeletedIds(DELETED_HABITS_KEY);
export const mergeDeletedHabitIds = (ids: string[]) => mergeDeletedIds(DELETED_HABITS_KEY, ids);

// ── Journal entry deletion tracking ────────────────────────────────────────────

const DELETED_JOURNAL_ENTRIES_KEY = "zenflow-deleted-journal-entry-ids";

export const trackDeletedJournalEntryId = (id: string) =>
  trackDeletedId(DELETED_JOURNAL_ENTRIES_KEY, id);
export const getDeletedJournalEntryIds = () => getDeletedIds(DELETED_JOURNAL_ENTRIES_KEY);
export const mergeDeletedJournalEntryIds = (ids: string[]) =>
  mergeDeletedIds(DELETED_JOURNAL_ENTRIES_KEY, ids);

// ── Mood deletion tracking ────────────────────────────────────────────────────

const DELETED_MOODS_KEY = "zenflow-deleted-mood-ids";

export const trackDeletedMoodId = (id: string) => trackDeletedId(DELETED_MOODS_KEY, id);
export const getDeletedMoodIds = () => getDeletedIds(DELETED_MOODS_KEY);
export const mergeDeletedMoodIds = (ids: string[]) => mergeDeletedIds(DELETED_MOODS_KEY, ids);

// ── Focus session deletion tracking ───────────────────────────────────────────

const DELETED_FOCUS_SESSIONS_KEY = "zenflow-deleted-focus-session-ids";

export const trackDeletedFocusSessionId = (id: string) =>
  trackDeletedId(DELETED_FOCUS_SESSIONS_KEY, id);
export const getDeletedFocusSessionIds = () => getDeletedIds(DELETED_FOCUS_SESSIONS_KEY);
export const mergeDeletedFocusSessionIds = (ids: string[]) =>
  mergeDeletedIds(DELETED_FOCUS_SESSIONS_KEY, ids);

// ── Gratitude entry deletion tracking ─────────────────────────────────────────

const DELETED_GRATITUDE_KEY = "zenflow-deleted-gratitude-ids";

export const trackDeletedGratitudeId = (id: string) => trackDeletedId(DELETED_GRATITUDE_KEY, id);
export const getDeletedGratitudeIds = () => getDeletedIds(DELETED_GRATITUDE_KEY);
export const mergeDeletedGratitudeIds = (ids: string[]) =>
  mergeDeletedIds(DELETED_GRATITUDE_KEY, ids);
