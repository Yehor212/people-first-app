import {
  getDeletedFocusSessionIds,
  getDeletedGratitudeIds,
  getDeletedHabitIds,
  getDeletedJournalEntryIds,
  getDeletedMoodIds,
  mergeDeletedFocusSessionIds,
  mergeDeletedGratitudeIds,
  mergeDeletedHabitIds,
  mergeDeletedJournalEntryIds,
  mergeDeletedMoodIds,
} from "@/storage/deletionTracker";
import { db } from "@/storage/db";
import { logger } from "@/lib/logger";
import { supabase, getCurrentUserId } from "@/lib/supabaseClient";

export type TombstonedSyncEntity = "mood" | "habit" | "focus" | "gratitude" | "journal";

export interface SyncTombstoneRow {
  entity_type: string | null;
  entity_id: string | null;
  deleted_seq?: number | null;
}

export type SyncTombstoneIdSets = Record<TombstonedSyncEntity, Set<string>>;
export type SyncTombstoneIdLists = Record<TombstonedSyncEntity, string[]>;

const EMPTY_TOMBSTONE_LISTS: SyncTombstoneIdLists = {
  mood: [],
  habit: [],
  focus: [],
  gratitude: [],
  journal: [],
};

function isTombstonedSyncEntity(value: string): value is TombstonedSyncEntity {
  return (
    value === "mood" ||
    value === "habit" ||
    value === "focus" ||
    value === "gratitude" ||
    value === "journal"
  );
}

export function collectSyncTombstoneIds(rows: SyncTombstoneRow[]): SyncTombstoneIdLists {
  const ids: SyncTombstoneIdLists = {
    mood: [],
    habit: [],
    focus: [],
    gratitude: [],
    journal: [],
  };
  const seen: Record<TombstonedSyncEntity, Set<string>> = {
    mood: new Set(),
    habit: new Set(),
    focus: new Set(),
    gratitude: new Set(),
    journal: new Set(),
  };

  for (const row of rows) {
    const entityType = row.entity_type;
    const entityId = row.entity_id;
    if (!entityType || !entityId || !isTombstonedSyncEntity(entityType)) continue;
    if (seen[entityType].has(entityId)) continue;

    seen[entityType].add(entityId);
    ids[entityType].push(entityId);
  }

  return ids;
}

export async function mergeSyncTombstones(
  rows: SyncTombstoneRow[]
): Promise<SyncTombstoneIdSets> {
  const ids = rows.length > 0 ? collectSyncTombstoneIds(rows) : EMPTY_TOMBSTONE_LISTS;

  await Promise.all([
    ids.mood.length > 0 ? mergeDeletedMoodIds(ids.mood) : Promise.resolve(),
    ids.habit.length > 0 ? mergeDeletedHabitIds(ids.habit) : Promise.resolve(),
    ids.focus.length > 0 ? mergeDeletedFocusSessionIds(ids.focus) : Promise.resolve(),
    ids.gratitude.length > 0 ? mergeDeletedGratitudeIds(ids.gratitude) : Promise.resolve(),
    ids.journal.length > 0 ? mergeDeletedJournalEntryIds(ids.journal) : Promise.resolve(),
  ]);

  const [mood, habit, focus, gratitude, journal] = await Promise.all([
    getDeletedMoodIds(),
    getDeletedHabitIds(),
    getDeletedFocusSessionIds(),
    getDeletedGratitudeIds(),
    getDeletedJournalEntryIds(),
  ]);

  return { mood, habit, focus, gratitude, journal };
}

function hasAnyTombstoneIds(ids: SyncTombstoneIdSets): boolean {
  return (
    ids.mood.size > 0 ||
    ids.habit.size > 0 ||
    ids.focus.size > 0 ||
    ids.gratitude.size > 0 ||
    ids.journal.size > 0
  );
}

export async function purgeLocalRowsForSyncTombstones(
  ids: SyncTombstoneIdSets
): Promise<boolean> {
  if (!hasAnyTombstoneIds(ids)) return false;

  await db.transaction(
    "rw",
    [
      db.moods,
      db.habits,
      db.focusSessions,
      db.gratitudeEntries,
      db.journalEntries,
      db.journalPhotos,
      db.journalAudio,
    ],
    async () => {
      if (ids.mood.size > 0) await db.moods.bulkDelete([...ids.mood]);
      if (ids.habit.size > 0) await db.habits.bulkDelete([...ids.habit]);
      if (ids.focus.size > 0) await db.focusSessions.bulkDelete([...ids.focus]);
      if (ids.gratitude.size > 0) await db.gratitudeEntries.bulkDelete([...ids.gratitude]);
      if (ids.journal.size > 0) {
        const journalIds = [...ids.journal];
        await db.journalEntries.bulkDelete(journalIds);
        await db.journalPhotos.where("entryId").anyOf(journalIds).delete();
        await db.journalAudio.where("entryId").anyOf(journalIds).delete();
      }
    }
  );

  return true;
}

export async function fetchAndMergeServerTombstones(limit = 100000): Promise<SyncTombstoneIdSets> {
  if (!supabase) return mergeSyncTombstones([]);
  const userId = await getCurrentUserId();
  if (!userId) return mergeSyncTombstones([]);

  const { data, error } = await supabase
    .from("sync_tombstones")
    .select("entity_type, entity_id, deleted_seq")
    .eq("user_id", userId)
    .order("deleted_seq", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`[Sync] Failed to fetch server tombstones: ${error.message}`);
  }

  const ids = await mergeSyncTombstones(data || []);
  if (await purgeLocalRowsForSyncTombstones(ids)) {
    logger.sync("[Sync] Purged locally stale tombstoned rows before push");
  }
  return ids;
}

export async function isEntityTombstonedOnServer(
  entityType: TombstonedSyncEntity,
  entityId: string
): Promise<boolean> {
  if (!supabase) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { data, error } = await supabase
    .from("sync_tombstones")
    .select("entity_id")
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (error) {
    throw new Error(`[Sync] Failed to check server tombstone for ${entityType}:${entityId}`);
  }

  if (data?.entity_id === entityId) {
    const ids = await mergeSyncTombstones([{ entity_type: entityType, entity_id: entityId }]);
    await purgeLocalRowsForSyncTombstones(ids);
    return true;
  }

  return false;
}
