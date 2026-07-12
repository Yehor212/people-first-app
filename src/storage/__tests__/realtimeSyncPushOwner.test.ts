import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(() => Promise.resolve("account-a" as string | null)),
  fetchTombstones: vi.fn(),
  processBatched: vi.fn(),
  syncMood: vi.fn(),
  syncHabit: vi.fn(),
  syncFocusSession: vi.fn(),
  syncGratitude: vi.fn(),
  syncSetting: vi.fn(),
  syncJournalEntry: vi.fn(),
  syncJournalPhoto: vi.fn(),
  syncJournalAudio: vi.fn(),
  settingsToArray: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: vi.fn() },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/storage/sync/serverTombstones", () => ({
  fetchAndMergeServerTombstones: mocks.fetchTombstones,
  mergeSyncTombstones: vi.fn(),
}));

vi.mock("@/storage/sync", () => ({
  processBatched: mocks.processBatched,
  syncMood: mocks.syncMood,
  syncHabit: mocks.syncHabit,
  syncFocusSession: mocks.syncFocusSession,
  syncGratitude: mocks.syncGratitude,
  syncSetting: mocks.syncSetting,
  syncJournalEntry: mocks.syncJournalEntry,
  syncJournalPhoto: mocks.syncJournalPhoto,
  syncJournalAudio: mocks.syncJournalAudio,
}));

vi.mock("@/storage/db", () => {
  const emptyTable = { toArray: vi.fn(() => Promise.resolve([])) };
  return {
    db: {
      moods: emptyTable,
      habits: emptyTable,
      focusSessions: emptyTable,
      gratitudeEntries: emptyTable,
      settings: { toArray: mocks.settingsToArray },
      journalEntries: emptyTable,
      journalPhotos: emptyTable,
      journalAudio: emptyTable,
    },
  };
});

vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({ addCategorizedBreadcrumb: vi.fn() }));

import { pushToCloud } from "@/storage/realtimeSync";

describe("pushToCloud owner boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserId.mockResolvedValue("account-a");
    mocks.fetchTombstones.mockResolvedValue({
      mood: new Set<string>(),
      habit: new Set<string>(),
      focus: new Set<string>(),
      gratitude: new Set<string>(),
      journal: new Set<string>(),
    });
    mocks.settingsToArray.mockResolvedValue([
      {
        key: "journal_vault_key",
        value: { wrappedKey: "account-a-wrapped", createdAt: 100, updatedAt: 101 },
      },
    ]);
    mocks.processBatched.mockImplementation(
      async (items: unknown[], process: (item: unknown) => Promise<unknown>) => {
        for (const item of items) await process(item);
      }
    );
    mocks.syncSetting.mockResolvedValue(undefined);
  });

  it("passes the account captured before the settings snapshot to every setting upload", async () => {
    await expect(pushToCloud()).resolves.toBe(true);

    expect(mocks.fetchTombstones).toHaveBeenCalledWith(100000, "account-a");
    expect(mocks.syncSetting).toHaveBeenCalledWith(
      "journal_vault_key",
      { wrappedKey: "account-a-wrapped", createdAt: 100, updatedAt: 101 },
      "account-a"
    );
  });
});
