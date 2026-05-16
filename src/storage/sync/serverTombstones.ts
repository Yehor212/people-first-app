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

export type TombstonedSyncEntity = "mood" | "habit" | "focus" | "gratitude" | "journal";

export interface SyncTombstoneRow {
  entity_type: string | null;
  entity_id: string | null;
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
