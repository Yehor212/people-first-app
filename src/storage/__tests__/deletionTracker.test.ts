import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/storage/db";
import {
  getDeletedHabitIds,
  getDeletionTrackerKeyForSyncEntity,
  mergeDeletedHabitIds,
  trackDeletedHabitId,
} from "@/storage/deletionTracker";

describe("deletionTracker", () => {
  beforeEach(async () => {
    await db.open();
    await db.settings.clear();
  });

  it("exposes a just-started habit deletion before the IndexedDB write settles", async () => {
    const id = `habit-race-${Date.now()}`;

    const tracking = trackDeletedHabitId(id);
    const idsDuringWrite = await getDeletedHabitIds();

    expect(idsDuringWrite.has(id)).toBe(true);
    await tracking;

    const idsAfterWrite = await getDeletedHabitIds();
    expect(idsAfterWrite.has(id)).toBe(true);
  });

  it("maps sync delete events for every tombstoned entity family", () => {
    expect(getDeletionTrackerKeyForSyncEntity("habit")).toBe("zenflow-deleted-habit-ids");
    expect(getDeletionTrackerKeyForSyncEntity("journal")).toBe(
      "zenflow-deleted-journal-entry-ids"
    );
    expect(getDeletionTrackerKeyForSyncEntity("mood")).toBe("zenflow-deleted-mood-ids");
    expect(getDeletionTrackerKeyForSyncEntity("focus")).toBe(
      "zenflow-deleted-focus-session-ids"
    );
    expect(getDeletionTrackerKeyForSyncEntity("gratitude")).toBe("zenflow-deleted-gratitude-ids");
    expect(getDeletionTrackerKeyForSyncEntity("habit_completion")).toBeNull();
    expect(getDeletionTrackerKeyForSyncEntity("setting")).toBeNull();
  });

  it("keeps tombstones beyond the old local cap so stale backups cannot resurrect data", async () => {
    const ids = Array.from({ length: 5001 }, (_, index) => `habit-deleted-${index}`);

    await mergeDeletedHabitIds(ids);

    const deletedIds = await getDeletedHabitIds();
    expect(deletedIds.size).toBe(ids.length);
    expect(deletedIds.has(ids[0])).toBe(true);
    expect(deletedIds.has(ids[ids.length - 1])).toBe(true);
  });
});
