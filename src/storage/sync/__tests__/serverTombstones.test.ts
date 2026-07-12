import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(async (): Promise<string | null> => "account-a"),
  supabase: null as { from: ReturnType<typeof vi.fn> } | null,
}));

vi.mock("@/lib/supabaseClient", () => ({
  get supabase() {
    return authMocks.supabase;
  },
  getCurrentUserId: authMocks.getCurrentUserId,
}));
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
  fetchAndMergeServerTombstones,
  mergeSyncTombstones,
  purgeLocalRowsForSyncTombstones,
} from "@/storage/sync/serverTombstones";

describe("serverTombstones", () => {
  beforeEach(async () => {
    authMocks.getCurrentUserId.mockReset();
    authMocks.getCurrentUserId.mockResolvedValue("account-a");
    authMocks.supabase = null;
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
    const merged = await mergeSyncTombstones(
      [
        { entity_type: "mood", entity_id: "mood-del" },
        { entity_type: "habit", entity_id: "habit-del" },
        { entity_type: "focus", entity_id: "focus-del" },
        { entity_type: "gratitude", entity_id: "gratitude-del" },
        { entity_type: "journal", entity_id: "journal-del" },
      ],
      "account-a",
    );

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

    const ids = await mergeSyncTombstones(
      [
        { entity_type: "habit", entity_id: "habit-del" },
        { entity_type: "journal", entity_id: "journal-del" },
      ],
      "account-a",
    );

    await expect(
      purgeLocalRowsForSyncTombstones(ids, "account-a"),
    ).resolves.toBe(true);
    await expect(db.habits.get("habit-del")).resolves.toBeUndefined();
    await expect(db.journalEntries.get("journal-del")).resolves.toBeUndefined();
    await expect(db.journalPhotos.get("photo-del")).resolves.toBeUndefined();
    await expect(db.journalAudio.get("audio-del")).resolves.toBeUndefined();
  });

  it("rolls back a stale tombstone merge when the owner changes at transaction entry", async () => {
    authMocks.getCurrentUserId
      .mockResolvedValueOnce("account-a")
      .mockResolvedValue("account-b");

    await expect(
      mergeSyncTombstones(
        [{ entity_type: "habit", entity_id: "account-a-habit" }],
        "account-a",
      ),
    ).rejects.toThrow(/account boundary/i);

    expect((await getDeletedHabitIds()).has("account-a-habit")).toBe(false);
  });

  it("discards a fetched tombstone response when the owner changes before local merge", async () => {
    const response = Promise.resolve({
      data: [{ entity_type: "habit", entity_id: "account-a-fetched-habit" }],
      error: null,
    });
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      then: response.then.bind(response),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    authMocks.supabase = { from: vi.fn(() => query) };
    authMocks.getCurrentUserId
      .mockResolvedValueOnce("account-a")
      .mockResolvedValue("account-b");

    await expect(
      fetchAndMergeServerTombstones(100000, "account-a"),
    ).rejects.toThrow(/account boundary/i);

    expect((await getDeletedHabitIds()).has("account-a-fetched-habit")).toBe(false);
  });

  it("rolls back tombstoned-row deletion when the owner changes before commit", async () => {
    const habit: Habit = {
      id: "account-a-purge-race",
      name: "Account A habit",
      icon: "leaf",
      color: 0,
      position: 0,
      createdAt: Date.now(),
      habitType: "boolean",
      frequency: { numerator: 1, denominator: 1 },
      question: "Done?",
      description: "",
      isArchived: false,
      targetValue: 1,
      targetType: "atLeast",
      unit: "",
      entries: {},
      reminders: [],
    };
    await db.habits.put(habit);
    authMocks.getCurrentUserId
      .mockResolvedValueOnce("account-a")
      .mockResolvedValueOnce("account-a")
      .mockResolvedValue("account-b");

    await expect(
      purgeLocalRowsForSyncTombstones(
        {
          mood: new Set(),
          habit: new Set([habit.id]),
          focus: new Set(),
          gratitude: new Set(),
          journal: new Set(),
        },
        "account-a",
      ),
    ).rejects.toThrow(/account boundary/i);

    await expect(db.habits.get(habit.id)).resolves.toEqual(habit);
  });
});
