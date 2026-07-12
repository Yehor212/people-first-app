import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  from: vi.fn(),
  enqueue: vi.fn(),
  isCloudSyncEnabled: vi.fn(),
  getDeletedJournalEntryIds: vi.fn(),
  trackDeletedJournalEntryId: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  writeEventAndBroadcast: vi.fn(),
  generateEmbeddings: vi.fn(),
  isEntityTombstonedOnServer: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: mocks.from },
  getCurrentUserId: mocks.getCurrentUserId,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: { enqueue: mocks.enqueue },
}));

vi.mock("@/lib/cloudSyncSettings", () => ({
  isCloudSyncEnabled: mocks.isCloudSyncEnabled,
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

vi.mock("../serverTombstones", () => ({
  isEntityTombstonedOnServer: mocks.isEntityTombstonedOnServer,
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

import {
  deleteJournalAudioFromCloud,
  deleteJournalEntryFromCloud,
  deleteJournalPhotoFromCloud,
  syncJournalAudio,
  syncJournalEntry,
  syncJournalPhoto,
} from "../syncJournal";

describe("journal sync tombstones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.isCloudSyncEnabled.mockReturnValue(true);
    mocks.getDeletedJournalEntryIds.mockResolvedValue(new Set());
    mocks.getPersistentDeviceId.mockResolvedValue("device-1");
    mocks.generateEmbeddings.mockResolvedValue(undefined);
    mocks.isEntityTombstonedOnServer.mockResolvedValue(false);
  });

  it("does not generate external AI embeddings during a normal journal sync", async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: null }));
    mocks.from.mockReturnValue({ upsert });

    await syncJournalEntry({
      id: "entry-1",
      date: "2026-05-25",
      title: "Private",
      content: "Private diary content",
      stickers: [],
      tags: [],
      photoIds: [],
      createdAt: 1,
      updatedAt: 2,
    }, "user-1");

    expect(upsert).toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).toHaveBeenCalledWith(
      "journal",
      "entry-1",
      "upsert",
      expect.objectContaining({ id: "entry-1" }),
      "device-1",
      { expectedOwnerUserId: "user-1" }
    );
    expect(mocks.generateEmbeddings).not.toHaveBeenCalled();
  });

  it("does not write or queue private journal data when cloud sync is disabled", async () => {
    mocks.isCloudSyncEnabled.mockReturnValue(false);

    await syncJournalEntry({
      id: "entry-local",
      date: "2026-05-25",
      title: "Local only",
      content: "Private diary content",
      stickers: [],
      tags: [],
      photoIds: [],
      createdAt: 1,
      updatedAt: 2,
    }, "user-1");
    await syncJournalPhoto({
      id: "photo-local",
      entryId: "entry-local",
      width: 640,
      height: 480,
      createdAt: 1,
      storagePath: "user/photo.jpg",
    }, "user-1");
    await syncJournalAudio({
      id: "audio-local",
      entryId: "entry-local",
      duration: 9,
      mimeType: "audio/mp4",
      createdAt: 1,
      storagePath: "user/audio.m4a",
    }, "user-1");
    await deleteJournalEntryFromCloud("entry-local", "user-1");
    await deleteJournalPhotoFromCloud("photo-local", "user-1");
    await deleteJournalAudioFromCloud("audio-local", "user-1");

    expect(mocks.getCurrentUserId).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
    expect(mocks.trackDeletedJournalEntryId).not.toHaveBeenCalled();
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
    }, "user-1");

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
    expect(mocks.generateEmbeddings).not.toHaveBeenCalled();
  });

  it("queues photo metadata through an id-only upload retry action while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    const photoWithPrivateData = {
      id: "photo-1",
      entryId: "entry-1",
      data: "data:image/jpeg;base64,private-photo",
      thumbnail: "data:image/jpeg;base64,private-thumb",
      width: 640,
      height: 480,
      createdAt: 1,
    };

    await syncJournalPhoto(photoWithPrivateData, "user-1");

    expect(mocks.enqueue).toHaveBeenCalledWith(
      "UPLOAD_JOURNAL_PHOTO_STORAGE",
      "journal-photo-upload:photo-1",
      {
        id: "photo-1",
        metadata: {
          id: "photo-1",
          entryId: "entry-1",
          width: 640,
          height: 480,
          createdAt: 1,
        },
      },
      expect.objectContaining({ priority: "high" })
    );
    expect(JSON.stringify(mocks.enqueue.mock.calls[0][2])).not.toContain("private-photo");
  });

  it("syncs photo metadata with storage path only and clears legacy signed URLs", async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: null }));
    mocks.from.mockReturnValue({ upsert });

    await syncJournalPhoto({
      id: "photo-1",
      entryId: "entry-1",
      width: 640,
      height: 480,
      createdAt: 1,
      storagePath: "user-1/photo-1.jpg",
    }, "user-1");

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        storage_path: "user-1/photo-1.jpg",
        storage_url: null,
      }),
      expect.objectContaining({ onConflict: "id" })
    );
  });

  it("queues photo delete through an id-only durable media action while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await deleteJournalPhotoFromCloud("photo-1", "user-1");

    expect(mocks.enqueue).toHaveBeenCalledWith(
      "DELETE_JOURNAL_PHOTO_STORAGE",
      "journal-photo-delete:photo-1",
      { id: "photo-1" },
      expect.objectContaining({ priority: "high" })
    );
  });

  it("queues audio metadata through an id-only upload retry action while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    const audioWithPrivateData = {
      id: "audio-1",
      entryId: "entry-1",
      data: "data:audio/webm;base64,private-audio",
      duration: 15,
      mimeType: "audio/webm",
      createdAt: 1,
    };

    await syncJournalAudio(audioWithPrivateData, "user-1");

    expect(mocks.enqueue).toHaveBeenCalledWith(
      "UPLOAD_JOURNAL_AUDIO_STORAGE",
      "journal-audio-upload:audio-1",
      {
        id: "audio-1",
        metadata: {
          id: "audio-1",
          entryId: "entry-1",
          duration: 15,
          mimeType: "audio/webm",
          createdAt: 1,
        },
      },
      expect.objectContaining({ priority: "high" })
    );
    expect(JSON.stringify(mocks.enqueue.mock.calls[0][2])).not.toContain("private-audio");
  });

  it("syncs audio metadata with storage path only and clears legacy signed URLs", async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: null }));
    mocks.from.mockReturnValue({ upsert });

    await syncJournalAudio({
      id: "audio-1",
      entryId: "entry-1",
      duration: 15,
      mimeType: "audio/mp4",
      createdAt: 1,
      storagePath: "user-1/audio-1.m4a",
    }, "user-1");

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        storage_path: "user-1/audio-1.m4a",
        storage_url: null,
      }),
      expect.objectContaining({ onConflict: "id" })
    );
  });

  it("queues audio delete through an id-only durable media action while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await deleteJournalAudioFromCloud("audio-1", "user-1");

    expect(mocks.enqueue).toHaveBeenCalledWith(
      "DELETE_JOURNAL_AUDIO_STORAGE",
      "journal-audio-delete:audio-1",
      { id: "audio-1" },
      expect.objectContaining({ priority: "high" })
    );
  });

  it("queues journal entry delete after a network error keeps the local tombstone durable", async () => {
    const deleteResult = { error: new TypeError("Failed to fetch") };
    const eqTwice = vi.fn(() => Promise.resolve(deleteResult));
    const eqOnce = vi.fn(() => ({ eq: eqTwice }));
    const deleteQuery = vi.fn(() => ({ eq: eqOnce }));
    mocks.from.mockReturnValue({ delete: deleteQuery });

    await deleteJournalEntryFromCloud("entry-1", "user-1");

    expect(mocks.trackDeletedJournalEntryId).toHaveBeenCalledWith("entry-1");
    expect(mocks.enqueue).toHaveBeenCalledWith(
      "DELETE_JOURNAL_ENTRY",
      "entry-1",
      {
        id: "entry-1",
      },
      {
        expectedOwnerUserId: "user-1",
      }
    );
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("tracks journal tombstones before queueing an offline delete", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await deleteJournalEntryFromCloud("entry-1", "user-1");

    expect(mocks.trackDeletedJournalEntryId).toHaveBeenCalledWith("entry-1");
    expect(mocks.enqueue).toHaveBeenCalledWith(
      "DELETE_JOURNAL_ENTRY",
      "entry-1",
      {
        id: "entry-1",
      },
      {
        expectedOwnerUserId: "user-1",
      }
    );
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });
});
