import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cloudSyncSettings", () => ({ isCloudSyncEnabled: () => false }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), log: vi.fn() },
}));
vi.mock("@/storage/realtimeSync", () => ({
  syncJournalEntry: vi.fn(() => Promise.resolve()),
  deleteJournalEntryFromCloud: vi.fn(() => Promise.resolve()),
  syncJournalPhoto: vi.fn(() => Promise.resolve()),
  syncJournalAudio: vi.fn(() => Promise.resolve()),
  deleteJournalPhotoFromCloud: vi.fn(() => Promise.resolve()),
  deleteJournalAudioFromCloud: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/storage/cloudSync", () => ({ triggerSync: vi.fn() }));
vi.mock("@/storage/journalStorageService", () => ({
  JOURNAL_PHOTO_UPLOAD_MAX_BYTES: 1_048_576,
  uploadPhoto: vi.fn(() => Promise.resolve(null)),
  uploadEncryptedPhoto: vi.fn(() => Promise.resolve(null)),
  uploadAudio: vi.fn(() => Promise.resolve(null)),
  uploadEncryptedAudio: vi.fn(() => Promise.resolve(null)),
  deletePhotoFromStorage: vi.fn(() => Promise.resolve()),
  deleteAudioFromStorage: vi.fn(() => Promise.resolve()),
  deleteEntryMediaFromStorage: vi.fn(() => Promise.resolve()),
  deleteJournalMediaStoragePath: vi.fn(() => Promise.resolve()),
  downloadAsBase64: vi.fn(() => Promise.resolve(null)),
}));

import { db } from "@/storage/db";
import { deleteEntry, saveEntry } from "../journalStorage";

const fixtureEntry = {
  date: "2026-07-29",
  title: "Atomic link fixture",
  content: "Isolated test content",
  stickers: [],
  photoIds: [],
  audioIds: [],
  tags: [],
};

describe("journal entry and required space links commit atomically", () => {
  beforeEach(async () => {
    await db.transaction(
      "rw",
      [db.journalEntries, db.journalEntryLinks, db.offlineQueue, db.settings],
      async () => {
        await db.journalEntries.clear();
        await db.journalEntryLinks.clear();
        await db.offlineQueue.clear();
        await db.settings.clear();
      },
    );
  });

  afterAll(async () => {
    await db.journalEntries.clear();
    await db.journalEntryLinks.clear();
  });

  it("persists a new entry and its required space links in one commit", async () => {
    const entry = await saveEntry(fixtureEntry, undefined, ["space-fixture"]);

    await expect(db.journalEntries.get(entry.id)).resolves.toBeDefined();
    await expect(db.journalEntryLinks.where("entryId").equals(entry.id).toArray()).resolves.toEqual([
      expect.objectContaining({
        entryId: entry.id,
        targetType: "space",
        targetId: "space-fixture",
      }),
    ]);
  });

  it("rolls back the entry when the required link write fails", async () => {
    const bulkAdd = vi
      .spyOn(db.journalEntryLinks, "bulkAdd")
      .mockRejectedValueOnce(new Error("fixture link write failed"));

    await expect(
      saveEntry(fixtureEntry, undefined, ["space-fixture"]),
    ).rejects.toThrow("fixture link write failed");
    await expect(db.journalEntries.count()).resolves.toBe(0);
    await expect(db.journalEntryLinks.count()).resolves.toBe(0);

    bulkAdd.mockRestore();
  });

  it("removes every entry link in the same local delete", async () => {
    const entry = await saveEntry(fixtureEntry, undefined, ["space-fixture"]);

    await deleteEntry(entry.id);

    await expect(db.journalEntries.get(entry.id)).resolves.toBeUndefined();
    await expect(db.journalEntryLinks.where("entryId").equals(entry.id).count()).resolves.toBe(0);
  });
});
