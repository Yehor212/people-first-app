import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/storage/db";
import { importBackup, type BackupPayloadV3 } from "@/storage/backup";
import { getDeletedHabitIds } from "@/storage/deletionTracker";
import { makeTestHabit } from "@/test/habitFixtures";

describe("importBackup deletion precedence", () => {
  beforeEach(async () => {
    await db.open();
    await db.moods.clear();
    await db.habits.clear();
    await db.focusSessions.clear();
    await db.gratitudeEntries.clear();
    await db.settings.clear();
    await db.journalEntries.clear();
    await db.journalPhotos.clear();
    await db.journalAudio.clear();
  });

  it("keeps tombstones authoritative in replace mode when backup still contains the habit", async () => {
    const deletedHabit = makeTestHabit({
      id: "habit-deleted-from-v2",
      name: "Deleted from V2",
      updatedAt: "2026-05-11T10:00:00.000Z",
    });
    const liveHabit = makeTestHabit({
      id: "habit-live",
      name: "Still active",
      updatedAt: "2026-05-11T10:00:00.000Z",
    });
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-05-11T10:01:00.000Z",
      deviceId: "device-test",
      data: {
        moods: [],
        habits: [deletedHabit, liveHabit],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [],
        journalPhotos: [],
        journalAudio: [],
      },
      deletedHabitIds: [deletedHabit.id],
    };

    const report = await importBackup(payload, "replace");

    const stored = await db.habits.toArray();
    expect(stored.map((habit) => habit.id)).toEqual([liveHabit.id]);
    expect(report.habits).toEqual({ added: 1, updated: 0, skipped: 1 });
    expect((await getDeletedHabitIds()).has(deletedHabit.id)).toBe(true);
  });

  it("accepts large permanent tombstone lists so old deletions stay authoritative", async () => {
    const deletedHabit = makeTestHabit({
      id: "habit-deleted-after-legacy-limit",
      name: "Deleted after legacy limit",
      updatedAt: "2026-05-11T10:00:00.000Z",
    });
    const tombstones = Array.from({ length: 10001 }, (_, index) => `habit-tombstone-${index}`);
    tombstones[0] = deletedHabit.id;
    const payload: BackupPayloadV3 = {
      schemaVersion: 3,
      createdAt: "2026-05-11T10:01:00.000Z",
      deviceId: "device-test",
      data: {
        moods: [],
        habits: [deletedHabit],
        focusSessions: [],
        gratitudeEntries: [],
        settings: [],
        journalEntries: [],
        journalPhotos: [],
        journalAudio: [],
      },
      deletedHabitIds: tombstones,
    };

    const report = await importBackup(payload, "replace");

    expect(await db.habits.toArray()).toEqual([]);
    expect(report.habits).toEqual({ added: 0, updated: 0, skipped: 1 });
    const deletedIds = await getDeletedHabitIds();
    expect(deletedIds.size).toBe(tombstones.length);
    expect(deletedIds.has(deletedHabit.id)).toBe(true);
    expect(deletedIds.has(tombstones[tombstones.length - 1])).toBe(true);
  });
});
