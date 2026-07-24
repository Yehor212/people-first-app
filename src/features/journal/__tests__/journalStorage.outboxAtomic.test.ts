import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cloudSyncSettings", () => ({ isCloudSyncEnabled: () => true }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), log: vi.fn() },
}));
vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: () => Promise.resolve("owner-1"),
  getCurrentUserId: () => Promise.resolve("owner-1"),
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
  validateSyncOwner: vi.fn(() => Promise.resolve("owner-1")),
}));

import { offlineQueue } from "@/lib/offlineQueue";
import { db } from "@/storage/db";
import {
  deleteDraftMedia,
  deleteAudio,
  deleteEntry,
  deletePhoto,
  saveEntry,
  storeAudio,
  updateEntry,
} from "../journalStorage";
import { getJournalDraftMediaOwnerId } from "../types";

describe("journal core writes use a durable outbox", () => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await offlineQueue.clearQueue();
    if (originalOnline) {
      Object.defineProperty(navigator, "onLine", originalOnline);
    } else {
      Reflect.deleteProperty(navigator, "onLine");
    }
  });

  it("persists a create action before saveEntry resolves", async () => {
    const entry = await saveEntry({
      date: "2026-07-13",
      title: "Durable create",
      content: "content",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
    });

    expect(await db.offlineQueue.where("entityId").equals(entry.id).toArray()).toEqual([
      expect.objectContaining({
        type: "SYNC_JOURNAL_ENTRY",
        ownerUserId: "owner-1",
        priority: "critical",
      }),
    ]);
  });

  it("persists the latest update action before updateEntry resolves", async () => {
    await db.journalEntries.add({
      id: "entry-update",
      date: "2026-07-13",
      title: "Before",
      content: "before",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });

    await updateEntry("entry-update", { content: "after" });

    expect(await db.offlineQueue.where("entityId").equals("entry-update").toArray()).toEqual([
      expect.objectContaining({
        type: "SYNC_JOURNAL_ENTRY",
        ownerUserId: "owner-1",
        payload: expect.objectContaining({ content: "after" }),
      }),
    ]);
  });

  it("updates an entry, relinks draft media, and persists every outbox action atomically", async () => {
    const draftMediaOwnerId = getJournalDraftMediaOwnerId("entry-media-update");
    await db.journalEntries.add({
      id: "entry-media-update",
      date: "2026-07-13",
      title: "Before media",
      content: "before",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });
    await db.journalPhotos.add({
      id: "draft-photo-update",
      entryId: draftMediaOwnerId,
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
      width: 800,
      height: 600,
      createdAt: 1,
    });
    await db.journalAudio.add({
      id: "draft-audio-update",
      entryId: draftMediaOwnerId,
      data: "data:audio/webm;base64,YXVkaW8=",
      duration: 1,
      mimeType: "audio/webm",
      createdAt: 1,
    });

    await updateEntry("entry-media-update", {
      photoIds: ["draft-photo-update"],
      audioIds: ["draft-audio-update"],
    }, 1);

    expect((await db.journalPhotos.get("draft-photo-update"))?.entryId).toBe("entry-media-update");
    expect((await db.journalAudio.get("draft-audio-update"))?.entryId).toBe("entry-media-update");
    expect(await db.offlineQueue.toArray()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "SYNC_JOURNAL_ENTRY",
          entityId: "entry-media-update",
        }),
        expect.objectContaining({
          type: "UPLOAD_JOURNAL_PHOTO_STORAGE",
          entityId: "journal-photo-upload:draft-photo-update",
        }),
        expect.objectContaining({
          type: "UPLOAD_JOURNAL_AUDIO_STORAGE",
          entityId: "journal-audio-upload:draft-audio-update",
        }),
      ]),
    );
  });

  it("removes detached media and persists its delete outbox in the same entry update", async () => {
    await db.journalEntries.add({
      id: "entry-media-remove",
      date: "2026-07-13",
      title: "Before media removal",
      content: "before",
      stickers: [],
      photoIds: ["photo-remove-atomically"],
      audioIds: ["audio-remove-atomically"],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });
    await db.journalPhotos.add({
      id: "photo-remove-atomically",
      entryId: "entry-media-remove",
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
      width: 800,
      height: 600,
      createdAt: 1,
    });
    await db.journalAudio.add({
      id: "audio-remove-atomically",
      entryId: "entry-media-remove",
      data: "data:audio/webm;base64,YXVkaW8=",
      duration: 1,
      mimeType: "audio/webm",
      createdAt: 1,
    });

    await updateEntry(
      "entry-media-remove",
      { photoIds: [], audioIds: [] },
      1,
    );

    expect(await db.journalPhotos.get("photo-remove-atomically")).toBeUndefined();
    expect(await db.journalAudio.get("audio-remove-atomically")).toBeUndefined();
    expect(await db.offlineQueue.toArray()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "DELETE_JOURNAL_PHOTO_STORAGE",
          entityId: "journal-photo-delete:photo-remove-atomically",
        }),
        expect.objectContaining({
          type: "DELETE_JOURNAL_AUDIO_STORAGE",
          entityId: "journal-audio-delete:audio-remove-atomically",
        }),
      ]),
    );
  });

  it("enforces the audio limit inside the serialized write", async () => {
    await db.journalAudio.bulkAdd(
      Array.from({ length: 2 }, (_, index) => ({
        id: `audio-existing-${index}`,
        entryId: "entry-audio-limit",
        data: "data:audio/webm;base64,YXVkaW8=",
        duration: 1,
        mimeType: "audio/webm",
        createdAt: index + 1,
      })),
    );

    const results = await Promise.allSettled([
      storeAudio("entry-audio-limit", "data:audio/webm;base64,YQ==", 1, "audio/webm"),
      storeAudio("entry-audio-limit", "data:audio/webm;base64,Yg==", 1, "audio/webm"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await db.journalAudio.where("entryId").equals("entry-audio-limit").count()).toBe(3);
  });

  it("commits the permanent tombstone, delete and delete outbox together", async () => {
    await db.journalEntries.add({
      id: "entry-delete",
      date: "2026-07-13",
      title: "Delete",
      content: "delete",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });

    await deleteEntry("entry-delete");

    expect(await db.journalEntries.get("entry-delete")).toBeUndefined();
    expect(await db.offlineQueue.where("entityId").equals("entry-delete").toArray()).toEqual([
      expect.objectContaining({
        type: "DELETE_JOURNAL_ENTRY",
        ownerUserId: "owner-1",
        priority: "critical",
      }),
    ]);
  });

  it("commits an individual photo delete and its storage outbox together", async () => {
    await db.journalEntries.add({
      id: "entry-photo-delete",
      date: "2026-07-13",
      title: "Photo delete",
      content: "content",
      stickers: [],
      photoIds: ["photo-delete"],
      audioIds: [],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });
    await db.journalPhotos.add({
      id: "photo-delete",
      entryId: "entry-photo-delete",
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
      width: 800,
      height: 600,
      createdAt: 1,
    });

    await deletePhoto("photo-delete", "entry-photo-delete");

    expect(await db.journalPhotos.get("photo-delete")).toBeUndefined();
    expect(
      await db.offlineQueue.where("entityId").equals("journal-photo-delete:photo-delete").toArray(),
    ).toEqual([
      expect.objectContaining({
        type: "DELETE_JOURNAL_PHOTO_STORAGE",
        ownerUserId: "owner-1",
        priority: "critical",
      }),
    ]);
  });

  it("commits draft media deletion and every storage outbox together", async () => {
    await db.journalPhotos.add({
      id: "draft-photo",
      entryId: "__draft__",
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
      width: 800,
      height: 600,
      createdAt: 1,
    });
    await db.journalAudio.add({
      id: "draft-audio",
      entryId: "__draft__",
      data: "data:audio/webm;base64,YXVkaW8=",
      duration: 1,
      mimeType: "audio/webm",
      createdAt: 1,
    });

    await deleteDraftMedia();

    expect(await db.journalPhotos.get("draft-photo")).toBeUndefined();
    expect(await db.journalAudio.get("draft-audio")).toBeUndefined();
    const queued = await db.offlineQueue.toArray();
    expect(queued).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "DELETE_JOURNAL_PHOTO_STORAGE",
          entityId: "journal-photo-delete:draft-photo",
          ownerUserId: "owner-1",
        }),
        expect.objectContaining({
          type: "DELETE_JOURNAL_AUDIO_STORAGE",
          entityId: "journal-audio-delete:draft-audio",
          ownerUserId: "owner-1",
        }),
      ]),
    );
  });

  it("commits an individual audio delete and its storage outbox together", async () => {
    await db.journalEntries.add({
      id: "entry-audio-delete",
      date: "2026-07-13",
      title: "Audio delete",
      content: "content",
      stickers: [],
      photoIds: [],
      audioIds: ["audio-delete"],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });
    await db.journalAudio.add({
      id: "audio-delete",
      entryId: "entry-audio-delete",
      data: "data:audio/webm;base64,YXVkaW8=",
      duration: 1,
      mimeType: "audio/webm",
      createdAt: 1,
    });

    await deleteAudio("audio-delete", "entry-audio-delete");

    expect(await db.journalAudio.get("audio-delete")).toBeUndefined();
    expect(
      await db.offlineQueue.where("entityId").equals("journal-audio-delete:audio-delete").toArray(),
    ).toEqual([
      expect.objectContaining({
        type: "DELETE_JOURNAL_AUDIO_STORAGE",
        ownerUserId: "owner-1",
        priority: "critical",
      }),
    ]);
  });

  it("keeps a committed create successful when the queue wake is deferred", async () => {
    vi.spyOn(offlineQueue, "wakeFromDurableStorage").mockRejectedValueOnce(
      new Error("queue wake unavailable"),
    );

    const entry = await saveEntry({
      date: "2026-07-16",
      title: "Committed locally",
      content: "The durable outbox is the source of sync recovery.",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
    });

    expect(await db.journalEntries.get(entry.id)).toBeDefined();
    expect(await db.offlineQueue.where("entityId").equals(entry.id).count()).toBe(1);
  });

  it("keeps a committed update successful when the queue wake is deferred", async () => {
    await db.journalEntries.add({
      id: "entry-wake-update",
      date: "2026-07-16",
      title: "Before",
      content: "before",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });
    vi.spyOn(offlineQueue, "wakeFromDurableStorage").mockRejectedValueOnce(
      new Error("queue wake unavailable"),
    );

    await updateEntry("entry-wake-update", { content: "after" }, 1);

    expect((await db.journalEntries.get("entry-wake-update"))?.content).toBe("after");
    expect(await db.offlineQueue.where("entityId").equals("entry-wake-update").count()).toBe(1);
  });

  it("keeps a committed entry delete successful when the queue wake is deferred", async () => {
    await db.journalEntries.add({
      id: "entry-wake-delete",
      date: "2026-07-16",
      title: "Delete",
      content: "delete",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });
    vi.spyOn(offlineQueue, "wakeFromDurableStorage").mockRejectedValueOnce(
      new Error("queue wake unavailable"),
    );

    await deleteEntry("entry-wake-delete");

    expect(await db.journalEntries.get("entry-wake-delete")).toBeUndefined();
    expect(await db.offlineQueue.where("entityId").equals("entry-wake-delete").count()).toBe(1);
  });

  it("keeps committed photo and audio deletes successful when queue wakes are deferred", async () => {
    await db.journalEntries.add({
      id: "entry-wake-media-delete",
      date: "2026-07-16",
      title: "Media delete",
      content: "content",
      stickers: [],
      photoIds: ["photo-wake-delete"],
      audioIds: ["audio-wake-delete"],
      tags: [],
      createdAt: 1,
      updatedAt: 1,
    });
    await db.journalPhotos.add({
      id: "photo-wake-delete",
      entryId: "entry-wake-media-delete",
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
      width: 800,
      height: 600,
      createdAt: 1,
    });
    await db.journalAudio.add({
      id: "audio-wake-delete",
      entryId: "entry-wake-media-delete",
      data: "data:audio/webm;base64,YXVkaW8=",
      duration: 1,
      mimeType: "audio/webm",
      createdAt: 1,
    });
    vi.spyOn(offlineQueue, "wakeFromDurableStorage")
      .mockRejectedValueOnce(new Error("photo queue wake unavailable"))
      .mockRejectedValueOnce(new Error("audio queue wake unavailable"));

    await deletePhoto("photo-wake-delete", "entry-wake-media-delete");
    await deleteAudio("audio-wake-delete", "entry-wake-media-delete");

    expect(await db.journalPhotos.get("photo-wake-delete")).toBeUndefined();
    expect(await db.journalAudio.get("audio-wake-delete")).toBeUndefined();
    expect(
      await db.offlineQueue.where("entityId").equals("journal-photo-delete:photo-wake-delete").count(),
    ).toBe(1);
    expect(
      await db.offlineQueue.where("entityId").equals("journal-audio-delete:audio-wake-delete").count(),
    ).toBe(1);
  });

  it("keeps committed draft media deletion successful when the queue wake is deferred", async () => {
    await db.journalPhotos.add({
      id: "draft-photo-wake-delete",
      entryId: "__draft__",
      data: "data:image/jpeg;base64,cGhvdG8=",
      thumbnail: "data:image/jpeg;base64,dGh1bWI=",
      width: 800,
      height: 600,
      createdAt: 1,
    });
    await db.journalAudio.add({
      id: "draft-audio-wake-delete",
      entryId: "__draft__",
      data: "data:audio/webm;base64,YXVkaW8=",
      duration: 1,
      mimeType: "audio/webm",
      createdAt: 1,
    });
    vi.spyOn(offlineQueue, "wakeFromDurableStorage").mockRejectedValueOnce(
      new Error("queue wake unavailable"),
    );

    await deleteDraftMedia();

    expect(await db.journalPhotos.get("draft-photo-wake-delete")).toBeUndefined();
    expect(await db.journalAudio.get("draft-audio-wake-delete")).toBeUndefined();
    expect(await db.offlineQueue.toArray()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: "journal-photo-delete:draft-photo-wake-delete" }),
        expect.objectContaining({ entityId: "journal-audio-delete:draft-audio-wake-delete" }),
      ]),
    );
  });
});
