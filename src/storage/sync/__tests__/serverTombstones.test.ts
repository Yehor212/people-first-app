import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/storage/db";
import type { Habit } from "@/types";
import {
  getDeletedFocusSessionIds,
  getDeletedGratitudeIds,
  getDeletedHabitIds,
  getDeletedJournalEntryIds,
  getDeletedMoodIds,
} from "@/storage/deletionTracker";
import {
  collectSyncTombstoneIds,
  mergeSyncTombstones,
  purgeLocalRowsForSyncTombstones,
} from "@/storage/sync/serverTombstones";

describe("serverTombstones", () => {
  beforeEach(async () => {
    await db.open();
    await db.settings.clear();
    await db.moods.clear();
    await db.habits.clear();
    await db.focusSessions.clear();
    await db.gratitudeEntries.clear();
    await db.journalEntries.clear();
    await db.journalPhotos.clear();
    await db.journalAudio.clear();
  });

  it("collects only supported sync tombstone entity families", () => {
    const ids = collectSyncTombstoneIds([
      { entity_type: "habit", entity_id: "habit-1" },
      { entity_type: "habit", entity_id: "habit-1" },
      { entity_type: "journal", entity_id: "journal-1" },
      { entity_type: "setting", entity_id: "setting-1" },
      { entity_type: null, entity_id: "missing-type" },
      { entity_type: "mood", entity_id: null },
    ]);

    expect(ids).toEqual({
      mood: [],
      habit: ["habit-1"],
      focus: [],
      gratitude: [],
      journal: ["journal-1"],
    });
  });

  it("merges server tombstones into every local anti-resurrection tracker", async () => {
    const merged = await mergeSyncTombstones([
      { entity_type: "mood", entity_id: "mood-del" },
      { entity_type: "habit", entity_id: "habit-del" },
      { entity_type: "focus", entity_id: "focus-del" },
      { entity_type: "gratitude", entity_id: "gratitude-del" },
      { entity_type: "journal", entity_id: "journal-del" },
    ]);

    expect(merged.mood.has("mood-del")).toBe(true);
    expect(merged.habit.has("habit-del")).toBe(true);
    expect(merged.focus.has("focus-del")).toBe(true);
    expect(merged.gratitude.has("gratitude-del")).toBe(true);
    expect(merged.journal.has("journal-del")).toBe(true);
    expect((await getDeletedMoodIds()).has("mood-del")).toBe(true);
    expect((await getDeletedHabitIds()).has("habit-del")).toBe(true);
    expect((await getDeletedFocusSessionIds()).has("focus-del")).toBe(true);
    expect((await getDeletedGratitudeIds()).has("gratitude-del")).toBe(true);
    expect((await getDeletedJournalEntryIds()).has("journal-del")).toBe(true);
  });

  it("purges stale local rows after server tombstones are merged", async () => {
    const staleHabit: Habit = {
      id: "habit-del",
      name: "Deleted habit",
      icon: "leaf",
      color: 0,
      position: 0,
      createdAt: Date.now(),
      habitType: "boolean",
      frequency: { numerator: 1, denominator: 1 },
      question: "Deleted?",
      description: "",
      isArchived: false,
      targetValue: 1,
      targetType: "atLeast",
      unit: "",
      entries: {},
      reminders: [],
    };

    await db.habits.put(staleHabit);
    await db.journalEntries.put({
      id: "journal-del",
      date: "2026-05-26",
      title: "Deleted",
      content: "stale",
      stickers: [],
      tags: [],
      photoIds: ["photo-del"],
      audioIds: ["audio-del"],
      createdAt: 1,
      updatedAt: 2,
    });
    await db.journalPhotos.put({ id: "photo-del", entryId: "journal-del", createdAt: 1 } as any);
    await db.journalAudio.put({ id: "audio-del", entryId: "journal-del", createdAt: 1 } as any);

    const ids = await mergeSyncTombstones([
      { entity_type: "habit", entity_id: "habit-del" },
      { entity_type: "journal", entity_id: "journal-del" },
    ]);

    await expect(purgeLocalRowsForSyncTombstones(ids)).resolves.toBe(true);
    await expect(db.habits.get("habit-del")).resolves.toBeUndefined();
    await expect(db.journalEntries.get("journal-del")).resolves.toBeUndefined();
    await expect(db.journalPhotos.get("photo-del")).resolves.toBeUndefined();
    await expect(db.journalAudio.get("audio-del")).resolves.toBeUndefined();
  });
});
