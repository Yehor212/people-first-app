import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/storage/db";
import { exportBackup, importBackup, type BackupPayloadV3 } from "@/storage/backup";
import {
  getDeletedHabitIds,
  mergeDeletedHabitIds,
  mergeDeletedJournalEntryIds,
} from "@/storage/deletionTracker";
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

  it("does not export locally tombstoned habits or journal media from stale IndexedDB rows", async () => {
    const deletedHabit = makeTestHabit({ id: "habit-stale", name: "Stale deleted" });
    const liveHabit = makeTestHabit({ id: "habit-live", name: "Live" });
    await db.habits.bulkAdd([deletedHabit, liveHabit]);
    await db.journalEntries.bulkAdd([
      {
        id: "journal-stale",
        date: "2026-05-25",
        title: "Deleted",
        content: "stale",
        stickers: [],
        tags: [],
        photoIds: ["photo-stale"],
        audioIds: ["audio-stale"],
        createdAt: 1,
        updatedAt: 2,
      } as any,
      {
        id: "journal-live",
        date: "2026-05-25",
        title: "Live",
        content: "keep",
        stickers: [],
        tags: [],
        photoIds: ["photo-live"],
        audioIds: ["audio-live"],
        createdAt: 1,
        updatedAt: 2,
      } as any,
    ]);
    await db.journalPhotos.bulkAdd([
      {
        id: "photo-stale",
        entryId: "journal-stale",
        data: "x",
        thumbnail: "x",
        createdAt: 1,
      } as any,
      { id: "photo-live", entryId: "journal-live", data: "x", thumbnail: "x", createdAt: 1 } as any,
    ]);
    await db.journalAudio.bulkAdd([
      {
        id: "audio-stale",
        entryId: "journal-stale",
        data: "x",
        mimeType: "audio/webm",
        duration: 1,
        createdAt: 1,
      } as any,
      {
        id: "audio-live",
        entryId: "journal-live",
        data: "x",
        mimeType: "audio/webm",
        duration: 1,
        createdAt: 1,
      } as any,
    ]);
    await mergeDeletedHabitIds([deletedHabit.id]);
    await mergeDeletedJournalEntryIds(["journal-stale"]);

    const backup = await exportBackup();

    expect(backup.data.habits.map((habit) => habit.id)).toEqual([liveHabit.id]);
    expect(backup.data.journalEntries?.map((entry) => entry.id)).toEqual(["journal-live"]);
    expect(backup.data.journalPhotos?.map((photo) => photo.id)).toEqual(["photo-live"]);
    expect(backup.data.journalAudio?.map((audio) => audio.id)).toEqual(["audio-live"]);
    expect(backup.deletedHabitIds).toContain(deletedHabit.id);
    expect(backup.deletedJournalEntryIds).toContain("journal-stale");
  });
});
