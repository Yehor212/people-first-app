import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cloudSyncSettings", () => ({ isCloudSyncEnabled: () => false }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), log: vi.fn() },
}));
vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: () => Promise.resolve(null),
  getCurrentUserId: () => Promise.resolve(null),
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
vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    enqueue: vi.fn(() => Promise.resolve()),
    wakeFromDurableStorage: vi.fn(() => Promise.resolve()),
  },
  persistCriticalOfflineActionInCurrentTransaction: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/storage/journalStorageService", () => ({
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
vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(() => Promise.resolve(null)),
}));

import { db } from "@/storage/db";
import { discardJournalDraft, saveEntry, updateEntry } from "../journalStorage";

describe("journal concurrent edit protection", () => {
  beforeEach(async () => {
    localStorage.clear();
    db.close();
    await db.delete();
    await db.open();
    await db.journalEntries.add({
      id: "entry-concurrent",
      date: "2026-07-13",
      title: "Original",
      content: "Original private text",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 100,
      updatedAt: 100,
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    db.close();
    await db.delete();
  });

  it("rejects a stale second editor without overwriting the first editor", async () => {
    vi.spyOn(Date, "now").mockReturnValue(200);
    await updateEntry("entry-concurrent", { content: "Saved in tab A" }, 100);

    await db.journalPhotos.add({
      id: "photo-from-stale-tab",
      entryId: "__draft__",
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
      width: 800,
      height: 600,
      createdAt: 200,
    });

    vi.mocked(Date.now).mockReturnValue(300);
    await expect(
      updateEntry(
        "entry-concurrent",
        {
          content: "Stale tab B overwrite",
          photoIds: ["photo-from-stale-tab"],
        },
        100,
      ),
    ).rejects.toMatchObject({
      name: "JournalEntryConflictError",
      code: "JOURNAL_ENTRY_CONFLICT",
    });

    expect((await db.journalEntries.get("entry-concurrent"))?.content).toBe("Saved in tab A");
    expect((await db.journalPhotos.get("photo-from-stale-tab"))?.entryId).toBe("__draft__");
  });

  it("rejects an update after the entry was deleted without relinking staged media", async () => {
    await db.journalEntries.delete("entry-concurrent");
    await db.journalPhotos.add({
      id: "photo-after-delete",
      entryId: "__draft__",
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
      width: 800,
      height: 600,
      createdAt: 200,
    });

    await expect(
      updateEntry(
        "entry-concurrent",
        { content: "Must not be recreated", photoIds: ["photo-after-delete"] },
        100,
      ),
    ).rejects.toMatchObject({
      name: "JournalEntryConflictError",
      code: "JOURNAL_ENTRY_CONFLICT",
    });

    expect(await db.journalEntries.get("entry-concurrent")).toBeUndefined();
    expect((await db.journalPhotos.get("photo-after-delete"))?.entryId).toBe("__draft__");
  });

  it("does not relink media owned by another draft session", async () => {
    await db.settings.put({
      key: "zenflow_journal_draft_lease_journal_draft_entry-concurrent:tab-b",
      value: { writerId: "writer-tab-b", heartbeatAt: Date.now() },
    });
    await db.journalPhotos.add({
      id: "photo-owned-by-tab-a",
      entryId: "__draft__:entry-concurrent:tab-a",
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
      width: 800,
      height: 600,
      createdAt: 200,
    });

    await updateEntry(
      "entry-concurrent",
      { photoIds: ["photo-owned-by-tab-a"] },
      100,
      {
        draftKey: "journal_draft_entry-concurrent:tab-b",
        mediaOwnerId: "__draft__:entry-concurrent:tab-b",
        writerId: "writer-tab-b",
      },
    );

    expect((await db.journalPhotos.get("photo-owned-by-tab-a"))?.entryId).toBe(
      "__draft__:entry-concurrent:tab-a",
    );
  });

  it("rolls back a new entry and media relink when atomic draft removal fails", async () => {
    const draftKey = "journal_draft_new:tab-a";
    const mediaOwnerId = "__draft__:new:tab-a";
    await db.settings.put({ key: draftKey, value: { content: "Private draft" } });
    await db.settings.put({
      key: `zenflow_journal_draft_lease_${draftKey}`,
      value: { writerId: "writer-tab-a", heartbeatAt: Date.now() },
    });
    await db.journalPhotos.add({
      id: "photo-from-tab-a",
      entryId: mediaOwnerId,
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
      width: 800,
      height: 600,
      createdAt: 200,
    });
    vi.spyOn(db.settings, "delete").mockRejectedValueOnce(new Error("settings write failed"));

    await expect(
      saveEntry(
        {
          date: "2026-07-13",
          title: "Atomic save",
          content: "Must roll back together",
          stickers: [],
          photoIds: ["photo-from-tab-a"],
          tags: [],
        },
        { draftKey, mediaOwnerId, writerId: "writer-tab-a" },
      ),
    ).rejects.toThrow("settings write failed");

    expect(await db.journalEntries.count()).toBe(1);
    expect((await db.journalPhotos.get("photo-from-tab-a"))?.entryId).toBe(mediaOwnerId);
    expect(await db.settings.get(draftKey)).toBeDefined();
  });

  it("rolls back media deletion when atomic draft discard fails", async () => {
    const draftKey = "journal_draft_new:tab-a";
    const mediaOwnerId = "__draft__:new:tab-a";
    await db.settings.put({ key: draftKey, value: { content: "Private draft" } });
    await db.settings.put({
      key: `zenflow_journal_draft_lease_${draftKey}`,
      value: { writerId: "writer-tab-a", heartbeatAt: Date.now() },
    });
    await db.journalPhotos.add({
      id: "photo-discard-tab-a",
      entryId: mediaOwnerId,
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
      width: 800,
      height: 600,
      createdAt: 200,
    });
    vi.spyOn(db.settings, "delete").mockRejectedValueOnce(new Error("settings write failed"));

    await expect(
      discardJournalDraft({ draftKey, mediaOwnerId, writerId: "writer-tab-a" }),
    ).rejects.toThrow(
      "settings write failed",
    );

    expect(await db.journalPhotos.get("photo-discard-tab-a")).toBeDefined();
    expect(await db.settings.get(draftKey)).toBeDefined();
  });
});
