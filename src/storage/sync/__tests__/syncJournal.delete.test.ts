import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  from: vi.fn(),
  enqueue: vi.fn(),
  getDeletedJournalEntryIds: vi.fn(),
  trackDeletedJournalEntryId: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  writeEventAndBroadcast: vi.fn(),
  generateEmbeddings: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: mocks.from },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: { enqueue: mocks.enqueue },
}));

vi.mock("@/storage/deletionTracker", () => ({
  getDeletedJournalEntryIds: mocks.getDeletedJournalEntryIds,
  trackDeletedJournalEntryId: mocks.trackDeletedJournalEntryId,
}));

vi.mock("@/storage/eventSync", () => ({
  getPersistentDeviceId: mocks.getPersistentDeviceId,
  writeEventAndBroadcast: mocks.writeEventAndBroadcast,
}));

vi.mock("@/lib/journalAI", () => ({
  generateEmbeddings: mocks.generateEmbeddings,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/validation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/validation")>("@/lib/validation");
  return {
    ...actual,
    isAbortError: vi.fn(() => false),
  };
});

import { deleteJournalEntryFromCloud, syncJournalEntry } from "../syncJournal";

describe("journal sync tombstones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.getDeletedJournalEntryIds.mockResolvedValue(new Set());
    mocks.getPersistentDeviceId.mockResolvedValue("device-1");
    mocks.generateEmbeddings.mockResolvedValue(undefined);
  });

  it("does not upsert a journal entry that already has a local tombstone", async () => {
    mocks.getDeletedJournalEntryIds.mockResolvedValue(new Set(["entry-1"]));

    await syncJournalEntry({
      id: "entry-1",
      date: "2026-05-25",
      title: "Deleted",
      content: "stale",
      stickers: [],
      tags: [],
      photoIds: [],
      createdAt: 1,
      updatedAt: 2,
    });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
    expect(mocks.generateEmbeddings).not.toHaveBeenCalled();
  });

  it("tracks journal tombstones before queueing an offline delete", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await deleteJournalEntryFromCloud("entry-1");

    expect(mocks.trackDeletedJournalEntryId).toHaveBeenCalledWith("entry-1");
    expect(mocks.enqueue).toHaveBeenCalledWith("DELETE_JOURNAL_ENTRY", "entry-1", {
      id: "entry-1",
    });
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });
});
