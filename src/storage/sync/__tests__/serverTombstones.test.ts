import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/storage/db";
import {
  getDeletedFocusSessionIds,
  getDeletedGratitudeIds,
  getDeletedHabitIds,
  getDeletedJournalEntryIds,
  getDeletedMoodIds,
} from "@/storage/deletionTracker";
import { collectSyncTombstoneIds, mergeSyncTombstones } from "@/storage/sync/serverTombstones";

describe("serverTombstones", () => {
  beforeEach(async () => {
    await db.open();
    await db.settings.clear();
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
});
