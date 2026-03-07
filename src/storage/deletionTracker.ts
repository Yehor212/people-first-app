import { db } from '@/storage/db';
import { logger } from '@/lib/logger';

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
    const existing = await getDeletedIds(key);
    existing.add(id);
    await db.settings.put({ key, value: [...existing] });
  } catch (error) {
    logger.error(`[DeletionTracker] Failed to track ${key}:`, error);
  }
}

async function untrackDeletedId(key: string, id: string): Promise<void> {
  try {
    const existing = await getDeletedIds(key);
    existing.delete(id);
    if (existing.size > 0) {
      await db.settings.put({ key, value: [...existing] });
    } else {
      await db.settings.delete(key);
    }
  } catch (error) {
    logger.error(`[DeletionTracker] Failed to untrack ${key}:`, error);
  }
}

async function mergeDeletedIds(key: string, remoteIds: string[]): Promise<void> {
  if (!remoteIds.length) return;
  try {
    const existing = await getDeletedIds(key);
    for (const id of remoteIds) {
      existing.add(id);
    }
    await db.settings.put({ key, value: [...existing] });
  } catch (error) {
    logger.error(`[DeletionTracker] Failed to merge ${key}:`, error);
  }
}

// ── Habit deletion tracking ────────────────────────────────────────────────────

const DELETED_HABITS_KEY = 'zenflow-deleted-habit-ids';

export const trackDeletedHabitId = (id: string) => trackDeletedId(DELETED_HABITS_KEY, id);
export const getDeletedHabitIds = () => getDeletedIds(DELETED_HABITS_KEY);
export const untrackDeletedHabitId = (id: string) => untrackDeletedId(DELETED_HABITS_KEY, id);
export const mergeDeletedHabitIds = (ids: string[]) => mergeDeletedIds(DELETED_HABITS_KEY, ids);

// ── Journal entry deletion tracking ────────────────────────────────────────────

const DELETED_JOURNAL_ENTRIES_KEY = 'zenflow-deleted-journal-entry-ids';

export const trackDeletedJournalEntryId = (id: string) => trackDeletedId(DELETED_JOURNAL_ENTRIES_KEY, id);
export const getDeletedJournalEntryIds = () => getDeletedIds(DELETED_JOURNAL_ENTRIES_KEY);
export const untrackDeletedJournalEntryId = (id: string) => untrackDeletedId(DELETED_JOURNAL_ENTRIES_KEY, id);
export const mergeDeletedJournalEntryIds = (ids: string[]) => mergeDeletedIds(DELETED_JOURNAL_ENTRIES_KEY, ids);
