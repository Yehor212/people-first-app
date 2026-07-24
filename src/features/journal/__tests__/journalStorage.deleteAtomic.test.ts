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
import { SK } from "@/lib/storageKeys";
import {
  DELETION_TRACKER_KEYS,
  getDeletedJournalEntryIds,
} from "@/storage/deletionTracker";
import {
  cancelPendingJournalEntryDeletes,
  commitPendingJournalEntryDelete,
  deleteEntry,
  getPendingJournalEntryDeletes,
  stagePendingJournalEntryDelete,
} from "../journalStorage";
import { getJournalDraftMediaOwnerId } from "../types";

describe("journal delete atomicity", () => {
  beforeEach(async () => {
    localStorage.clear();
    db.close();
    await db.delete();
    await db.open();
    await db.journalEntries.add({
      id: "entry-atomic",
      date: "2026-07-13",
      title: "Must survive a failed delete",
      content: "private",
      stickers: [],
      photoIds: ["photo-atomic"],
      audioIds: [],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });
    await db.journalPhotos.add({
      id: "photo-atomic",
      entryId: "entry-atomic",
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
      width: 800,
      height: 600,
      createdAt: 1,
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    db.close();
    await db.delete();
  });

  it("rolls back the permanent tombstone and media when the entry delete fails", async () => {
    await stagePendingJournalEntryDelete("entry-atomic", Date.now() + 5_000);
    vi.spyOn(db.journalEntries, "delete").mockRejectedValueOnce(
      new Error("simulated IndexedDB delete failure")
    );

    await expect(deleteEntry("entry-atomic")).rejects.toThrow(
      "simulated IndexedDB delete failure"
    );

    expect(await db.journalEntries.get("entry-atomic")).toBeDefined();
    expect(await db.journalPhotos.get("photo-atomic")).toBeDefined();
    expect(await getDeletedJournalEntryIds()).not.toContain("entry-atomic");
    expect(await db.settings.get(DELETION_TRACKER_KEYS.journal)).toBeUndefined();
    expect(await getPendingJournalEntryDeletes()).toEqual([
      expect.objectContaining({ id: "entry-atomic" }),
    ]);
  });

  it("persists and cancels an undo marker without copying private entry content", async () => {
    const expiresAt = Date.now() + 5_000;

    await expect(stagePendingJournalEntryDelete("entry-atomic", expiresAt)).resolves.toEqual([
      { id: "entry-atomic", expiresAt },
    ]);

    expect(await db.journalEntries.get("entry-atomic")).toBeDefined();
    const markerRecord = await db.settings.get("journal_pending_entry_deletes_v1");
    expect(JSON.stringify(markerRecord)).not.toContain("private");

    await cancelPendingJournalEntryDeletes(["entry-atomic"]);
    expect(await getPendingJournalEntryDeletes()).toEqual([]);
    expect(await db.journalEntries.get("entry-atomic")).toBeDefined();
  });

  it("bounds a persisted undo deadline to the local five-second window", async () => {
    const now = 1_784_000_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      await db.settings.put({
        key: "journal_pending_entry_deletes_v1",
        value: [{ id: "entry-atomic", expiresAt: now + 86_400_000 }],
      });

      await expect(getPendingJournalEntryDeletes()).resolves.toEqual([
        { id: "entry-atomic", expiresAt: now + 5_000 },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes the durable undo marker in the same successful permanent-delete transaction", async () => {
    await stagePendingJournalEntryDelete("entry-atomic", Date.now() + 5_000);

    await deleteEntry("entry-atomic");

    expect(await getPendingJournalEntryDeletes()).toEqual([]);
    expect(await db.journalEntries.get("entry-atomic")).toBeUndefined();
  });

  it("keeps recovery draft data through undo and removes it only with the permanent delete", async () => {
    const draftKey = SK.journalDraft("entry-atomic");
    const leaseKey = SK.journalDraftLease(draftKey);
    const draftMediaOwnerId = getJournalDraftMediaOwnerId("entry-atomic");
    await db.settings.bulkPut([
      {
        key: draftKey,
        value: {
          title: "Unsaved recovery",
          content: "latest private edit",
          photoIds: ["photo-draft"],
          audioIds: [],
        },
      },
      { key: leaseKey, value: { writerId: "writer", heartbeatAt: Date.now() } },
    ]);
    await db.journalPhotos.add({
      id: "photo-draft",
      entryId: draftMediaOwnerId,
      data: "data:image/jpeg;base64,ZHJhZnQ=",
      thumbnail: "data:image/jpeg;base64,ZHJhZnQtdGh1bWI=",
      width: 640,
      height: 480,
      createdAt: 2,
    });

    await stagePendingJournalEntryDelete("entry-atomic", Date.now() + 5_000);
    expect(await db.settings.get(draftKey)).toBeDefined();
    expect(await db.journalPhotos.get("photo-draft")).toBeDefined();

    await cancelPendingJournalEntryDeletes(["entry-atomic"]);
    expect(await db.settings.get(draftKey)).toBeDefined();
    expect(await db.journalPhotos.get("photo-draft")).toBeDefined();

    const expiresAt = Date.now() + 5_000;
    await stagePendingJournalEntryDelete("entry-atomic", expiresAt);
    await commitPendingJournalEntryDelete("entry-atomic", expiresAt);

    expect(await db.settings.get(draftKey)).toBeUndefined();
    expect(await db.settings.get(leaseKey)).toBeUndefined();
    expect(await db.journalPhotos.get("photo-draft")).toBeUndefined();
  });

  it("allows exactly one winner when undo and permanent commit race", async () => {
    const expiresAt = Date.now() + 5_000;
    await stagePendingJournalEntryDelete("entry-atomic", expiresAt);

    const [cancelledIds, commitAfterCancel] = await Promise.all([
      cancelPendingJournalEntryDeletes(["entry-atomic"]),
      commitPendingJournalEntryDelete("entry-atomic", expiresAt),
    ]);

    expect(cancelledIds).toEqual(["entry-atomic"]);
    expect(commitAfterCancel).toBe("not-claimed");
    expect(await db.journalEntries.get("entry-atomic")).toBeDefined();
    expect(await getDeletedJournalEntryIds()).not.toContain("entry-atomic");

    await stagePendingJournalEntryDelete("entry-atomic", Date.now() + 5_000);
    const commitAt = Date.now() + 5_000;
    const commitBeforeCancel = await commitPendingJournalEntryDelete(
      "entry-atomic",
      commitAt,
    );
    const cancelledAfterCommit = await cancelPendingJournalEntryDeletes([
      "entry-atomic",
    ]);

    expect(commitBeforeCancel).toBe("committed");
    expect(cancelledAfterCommit).toEqual([]);
    expect(await db.journalEntries.get("entry-atomic")).toBeUndefined();
    expect(await getDeletedJournalEntryIds()).toContain("entry-atomic");
  });
});
