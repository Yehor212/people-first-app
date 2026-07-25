import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cloudSyncSettings", () => ({ isCloudSyncEnabled: () => true }));
vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: () => Promise.resolve("owner-1"),
  getCurrentUserId: () => Promise.resolve("owner-1"),
}));
vi.mock("@/storage/cloudSync", () => ({ triggerSync: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

import { offlineQueue } from "@/lib/offlineQueue";
import { SK } from "@/lib/storageKeys";
import { db } from "@/storage/db";
import { importJournalBackup } from "../journalImport";

function backupFile(): File {
  const content = JSON.stringify({
    version: 2,
    exportedAt: 1,
    entries: [
      {
        id: "import-entry",
        date: "2026-07-13",
        title: "Imported",
        content: "content",
        stickers: [],
        photoIds: ["import-photo"],
        audioIds: ["import-audio"],
        tags: [],
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    photos: [
      {
        id: "import-photo",
        entryId: "import-entry",
        data: "data:image/jpeg;base64,cGhvdG8=",
        thumbnail: "data:image/jpeg;base64,dGh1bWI=",
        width: 800,
        height: 600,
        createdAt: 1,
      },
    ],
    audio: [
      {
        id: "import-audio",
        entryId: "import-entry",
        data: "data:audio/webm;base64,YXVkaW8=",
        duration: 1,
        mimeType: "audio/webm",
        createdAt: 1,
      },
    ],
  });
  const file = new File([content], "journal-backup.json", { type: "application/json" });
  if (!file.text) file.text = () => Promise.resolve(content);
  return file;
}

describe("journal import durable media outbox", () => {
  let originalOnline: PropertyDescriptor | undefined;

  beforeAll(() => {
    originalOnline = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  });

  beforeEach(async () => {
    await offlineQueue.waitForInit();
    await offlineQueue.clearQueue();
    await db.journalEntries.clear();
    await db.journalPhotos.clear();
    await db.journalAudio.clear();
    await db.settings.clear();
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: "owner-1" });
  });

  afterAll(async () => {
    await offlineQueue.clearQueue();
    if (originalOnline) Object.defineProperty(navigator, "onLine", originalOnline);
    else Reflect.deleteProperty(navigator, "onLine");
  });

  it("commits imported media rows and their upload actions together", async () => {
    const result = await importJournalBackup(backupFile());

    expect(result).toMatchObject({ imported: 1, photosImported: 1, audioImported: 1 });
    expect(await db.journalPhotos.get("import-photo")).toBeDefined();
    expect(await db.journalAudio.get("import-audio")).toBeDefined();
    expect(await db.offlineQueue.toArray()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "SYNC_JOURNAL_ENTRY",
          entityId: "import-entry",
          ownerUserId: "owner-1",
          priority: "critical",
        }),
        expect.objectContaining({
          type: "UPLOAD_JOURNAL_PHOTO_STORAGE",
          entityId: "journal-photo-upload:import-photo",
          ownerUserId: "owner-1",
          priority: "critical",
        }),
        expect.objectContaining({
          type: "UPLOAD_JOURNAL_AUDIO_STORAGE",
          entityId: "journal-audio-upload:import-audio",
          ownerUserId: "owner-1",
          priority: "critical",
        }),
      ]),
    );
  });

  it("keeps a successful local import truthful when waking the durable queue fails", async () => {
    vi.spyOn(offlineQueue, "wakeFromDurableStorage").mockRejectedValueOnce(
      new Error("queue wake failed"),
    );

    const result = await importJournalBackup(backupFile());

    expect(result).toMatchObject({
      imported: 1,
      photosImported: 1,
      audioImported: 1,
      syncPending: true,
      errors: [],
    });
    expect(await db.journalEntries.get("import-entry")).toBeDefined();
    expect(await db.offlineQueue.count()).toBeGreaterThan(0);
  });

  it("queues the updated parent entry when imported media is attached to an existing entry", async () => {
    await db.journalEntries.put({
      id: "import-entry",
      date: "2026-07-13",
      title: "Existing",
      content: "existing content",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });

    const result = await importJournalBackup(backupFile());

    expect(result).toMatchObject({
      imported: 0,
      skipped: 1,
      photosImported: 1,
      audioImported: 1,
      errors: [],
    });
    expect(await db.journalEntries.get("import-entry")).toMatchObject({
      photoIds: ["import-photo"],
      audioIds: ["import-audio"],
    });
    expect(await db.offlineQueue.toArray()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "SYNC_JOURNAL_ENTRY",
          entityId: "import-entry",
          ownerUserId: "owner-1",
          payload: expect.objectContaining({
            photoIds: ["import-photo"],
            audioIds: ["import-audio"],
          }),
        }),
      ]),
    );
  });

  it("atomically applies version 3 tombstones and queues owner-bound cloud cleanup", async () => {
    await db.journalEntries.put({
      id: "deleted-entry",
      date: "2026-07-12",
      title: "Delete me",
      content: "content",
      stickers: [],
      photoIds: ["deleted-photo"],
      audioIds: ["deleted-audio"],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });
    await db.journalPhotos.put({
      id: "deleted-photo",
      entryId: "deleted-entry",
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
      width: 800,
      height: 600,
      createdAt: 1,
    });
    await db.journalAudio.put({
      id: "deleted-audio",
      entryId: "deleted-entry",
      data: "data:audio/webm;base64,YXVkaW8=",
      duration: 1,
      mimeType: "audio/webm",
      createdAt: 1,
    });
    const content = JSON.stringify({
      version: 3,
      exportedAt: 2,
      entries: [],
      photos: [],
      audio: [],
      deletedEntryIds: ["deleted-entry"],
    });
    const file = new File([content], "journal-backup-v3.json", {
      type: "application/json",
    });
    if (!file.text) file.text = () => Promise.resolve(content);

    const result = await importJournalBackup(file);

    expect(result.errors).toEqual([]);
    expect(await db.journalEntries.get("deleted-entry")).toBeUndefined();
    expect(await db.journalPhotos.get("deleted-photo")).toBeUndefined();
    expect(await db.journalAudio.get("deleted-audio")).toBeUndefined();
    expect(await db.settings.get("zenflow-deleted-journal-entry-ids")).toMatchObject({
      value: ["deleted-entry"],
    });
    expect(await db.offlineQueue.toArray()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "DELETE_JOURNAL_ENTRY",
          entityId: "deleted-entry",
          ownerUserId: "owner-1",
        }),
        expect.objectContaining({
          type: "DELETE_JOURNAL_PHOTO_STORAGE",
          entityId: "journal-photo-delete:deleted-photo",
          ownerUserId: "owner-1",
        }),
        expect.objectContaining({
          type: "DELETE_JOURNAL_AUDIO_STORAGE",
          entityId: "journal-audio-delete:deleted-audio",
          ownerUserId: "owner-1",
        }),
      ]),
    );
  });
});
