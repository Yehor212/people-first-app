import {
  DELETION_TRACKER_KEYS,
  normalizeDeletedIdsForStorage,
} from "@/storage/deletionTracker";
import { db } from "@/storage/db";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabaseClient";
import Dexie from "dexie";
import { SyncOwnerBoundaryError, validateSyncOwner } from "@/storage/sync/syncOwner";

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

const TOMBSTONE_ENTITY_TYPES: TombstonedSyncEntity[] = [
  "mood",
  "habit",
  "focus",
  "gratitude",
  "journal",
];

function createEmptyTombstoneSets(): SyncTombstoneIdSets {
  return {
    mood: new Set(),
    habit: new Set(),
    focus: new Set(),
    gratitude: new Set(),
    journal: new Set(),
  };
}

function readStoredTombstoneIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
}

async function resolveTombstoneOwner(
  expectedOwnerUserId: string | undefined,
  operation: string,
  assertOwnerCurrent?: () => Promise<void>,
): Promise<string> {
  await assertOwnerCurrent?.();
  const ownerUserId = await validateSyncOwner(expectedOwnerUserId, operation);
  if (!ownerUserId) throw new SyncOwnerBoundaryError(operation);
  return ownerUserId;
}

async function assertTombstoneOwnerCurrent(
  ownerUserId: string,
  operation: string,
  assertOwnerCurrent?: () => Promise<void>,
): Promise<void> {
  await assertOwnerCurrent?.();
  await validateSyncOwner(ownerUserId, operation);
}

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
  rows: SyncTombstoneRow[],
  expectedOwnerUserId?: string,
  assertOwnerCurrent?: () => Promise<void>,
): Promise<SyncTombstoneIdSets> {
  const ownerUserId = await resolveTombstoneOwner(
    expectedOwnerUserId,
    "Server tombstone merge",
    assertOwnerCurrent,
  );
  const ids = rows.length > 0 ? collectSyncTombstoneIds(rows) : EMPTY_TOMBSTONE_LISTS;
  const merged = createEmptyTombstoneSets();

  await db.transaction("rw", [db.settings], async () => {
    await Dexie.waitFor(
      assertTombstoneOwnerCurrent(
        ownerUserId,
        "Server tombstone merge transaction",
        assertOwnerCurrent,
      ),
    );

    for (const entityType of TOMBSTONE_ENTITY_TYPES) {
      const key = DELETION_TRACKER_KEYS[entityType];
      const existing = await db.settings.get(key);
      const normalized = normalizeDeletedIdsForStorage([
        ...readStoredTombstoneIds(existing?.value),
        ...ids[entityType],
      ]);
      merged[entityType] = new Set(normalized);
      if (ids[entityType].length > 0) {
        await db.settings.put({ key, value: normalized });
      }
    }

    await Dexie.waitFor(
      assertTombstoneOwnerCurrent(
        ownerUserId,
        "Server tombstone merge transaction",
        assertOwnerCurrent,
      ),
    );
  });

  return merged;
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
  ids: SyncTombstoneIdSets,
  expectedOwnerUserId?: string,
  assertOwnerCurrent?: () => Promise<void>,
): Promise<boolean> {
  if (!hasAnyTombstoneIds(ids)) return false;

  const ownerUserId = await resolveTombstoneOwner(
    expectedOwnerUserId,
    "Server tombstone purge",
    assertOwnerCurrent,
  );

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
      await Dexie.waitFor(
        assertTombstoneOwnerCurrent(
          ownerUserId,
          "Server tombstone purge transaction",
          assertOwnerCurrent,
        ),
      );
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
      await Dexie.waitFor(
        assertTombstoneOwnerCurrent(
          ownerUserId,
          "Server tombstone purge transaction",
          assertOwnerCurrent,
        ),
      );
    }
  );

  return true;
}

export async function fetchAndMergeServerTombstones(
  limit = 100000,
  expectedOwnerUserId?: string,
  assertOwnerCurrent?: () => Promise<void>,
): Promise<SyncTombstoneIdSets> {
  if (!supabase) return createEmptyTombstoneSets();
  const ownerUserId = await resolveTombstoneOwner(
    expectedOwnerUserId,
    "Server tombstone fetch",
    assertOwnerCurrent,
  );

  const { data, error } = await supabase
    .from("sync_tombstones")
    .select("entity_type, entity_id, deleted_seq")
    .eq("user_id", ownerUserId)
    .order("deleted_seq", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`[Sync] Failed to fetch server tombstones: ${error.message}`);
  }

  await assertTombstoneOwnerCurrent(
    ownerUserId,
    "Server tombstone fetch",
    assertOwnerCurrent,
  );
  const ids = await mergeSyncTombstones(data || [], ownerUserId, assertOwnerCurrent);
  if (await purgeLocalRowsForSyncTombstones(ids, ownerUserId, assertOwnerCurrent)) {
    logger.sync("[Sync] Purged locally stale tombstoned rows before push");
  }
  return ids;
}

export async function isEntityTombstonedOnServer(
  entityType: TombstonedSyncEntity,
  entityId: string,
  expectedOwnerUserId?: string,
  assertOwnerCurrent?: () => Promise<void>,
): Promise<boolean> {
  if (!supabase) return false;
  const ownerUserId = await resolveTombstoneOwner(
    expectedOwnerUserId,
    "Server tombstone check",
    assertOwnerCurrent,
  );

  const { data, error } = await supabase
    .from("sync_tombstones")
    .select("entity_id")
    .eq("user_id", ownerUserId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (error) {
    throw new Error(`[Sync] Failed to check server tombstone for ${entityType}:${entityId}`);
  }

  await assertTombstoneOwnerCurrent(
    ownerUserId,
    "Server tombstone check",
    assertOwnerCurrent,
  );

  if (data?.entity_id === entityId) {
    const ids = await mergeSyncTombstones(
      [{ entity_type: entityType, entity_id: entityId }],
      ownerUserId,
      assertOwnerCurrent,
    );
    await purgeLocalRowsForSyncTombstones(ids, ownerUserId, assertOwnerCurrent);
    return true;
  }

  return false;
}
