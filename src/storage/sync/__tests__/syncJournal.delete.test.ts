import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  enqueue: vi.fn(),
  isCloudSyncEnabled: vi.fn(),
  getDeletedJournalEntryIds: vi.fn(),
  trackDeletedJournalEntryId: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  writeEventAndBroadcast: vi.fn(),
  generateEmbeddings: vi.fn(),
  isEntityTombstonedOnServer: vi.fn(),
  isAbortError: vi.fn(),
  journalEntryGet: vi.fn(),
  settingsGet: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
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

vi.mock("@/storage/db", () => ({
  db: {
    settings: {
      get: mocks.settingsGet,
    },
    journalEntries: {
      get: mocks.journalEntryGet,
    },
  },
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
    isAbortError: mocks.isAbortError,
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
    mocks.isAbortError.mockReturnValue(false);
    mocks.rpc.mockResolvedValue({ data: "complete", error: null });
    mocks.journalEntryGet.mockResolvedValue(undefined);
    mocks.settingsGet.mockResolvedValue(undefined);
  });

  it("does not publish a sync event when the server rejects a stale journal write", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const select = vi.fn(() => ({ maybeSingle }));
    const upsert = vi.fn(() => ({ select }));
    mocks.from.mockReturnValue({ upsert });

    await syncJournalEntry({
      id: "entry-stale",
      date: "2026-07-14",
      title: "Older title",
      content: "Older private diary content",
      stickers: [],
      tags: [],
      photoIds: [],
      createdAt: 1,
      updatedAt: 2,
    }, "user-1");

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "entry-stale",
        user_id: "user-1",
        updated_at: 2,
      }),
      { onConflict: "id" }
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "is_journal_entry_payload_current",
      {
        p_entry: expect.objectContaining({
          id: "entry-stale",
          user_id: "user-1",
          updated_at: 2,
        }),
      }
    );
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("does not generate external AI embeddings during a normal journal sync", async () => {
    const maybeSingle = vi.fn(() => Promise.resolve({ data: { id: "entry-1" }, error: null }));
    const select = vi.fn(() => ({ maybeSingle }));
    const upsert = vi.fn(() => ({ select }));
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

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "entry-1", user_id: "user-1" }),
      { onConflict: "id" }
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
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

  it("syncs style fields so customized entries restore on another device", async () => {
    const maybeSingle = vi.fn(() => Promise.resolve({ data: { id: "entry-styled" }, error: null }));
    const select = vi.fn(() => ({ maybeSingle }));
    const upsert = vi.fn(() => ({ select }));
    mocks.from.mockReturnValue({ upsert });

    await syncJournalEntry(
      {
        id: "entry-styled",
        date: "2026-05-25",
        title: "Styled",
        content: "Private styled diary content",
        stickers: [],
        tags: [],
        photoIds: [],
        audioIds: [],
        theme: "ocean",
        font: "cormorant",
        inkColor: "#34d399",
        paperTexture: "linen",
        bgPattern: "aurora",
        paperColor: "milky",
        bgIntensity: "dim",
        particleSpeed: "drift",
        fontSize: "large",
        createdAt: 1,
        updatedAt: 2,
      },
      "user-1"
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
          theme: "ocean",
          font: "cormorant",
          ink_color: "#34d399",
          paper_texture: "linen",
          bg_pattern: "aurora",
          paper_color: "milky",
          bg_intensity: "dim",
          particle_speed: "drift",
          font_size: "large",
      }),
      { onConflict: "id" }
    );
  });

  it("publishes the durable event for an exact replay after a lost response", async () => {
    const maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const select = vi.fn(() => ({ maybeSingle }));
    const upsert = vi.fn(() => ({ select }));
    mocks.from.mockReturnValue({ upsert });
    mocks.rpc.mockResolvedValue({ data: true, error: null });

    await syncJournalEntry({
      id: "entry-replay",
      date: "2026-07-14",
      title: "Current title",
      content: "Current private diary content",
      stickers: [],
      tags: [],
      photoIds: [],
      createdAt: 1,
      updatedAt: 4,
    }, "user-1");

    expect(mocks.rpc).toHaveBeenCalledWith(
      "is_journal_entry_payload_current",
      { p_entry: expect.objectContaining({ id: "entry-replay", updated_at: 4 }) }
    );
    expect(mocks.writeEventAndBroadcast).toHaveBeenCalled();
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

  it("publishes a parent refresh after uploaded audio metadata becomes durable", async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: null }));
    mocks.from.mockReturnValue({ upsert });
    mocks.journalEntryGet.mockResolvedValue({
      id: "entry-1",
      date: "2026-07-18",
      title: "Voice note",
      content: "encrypted:v1:private",
      stickers: [],
      tags: [],
      photoIds: [],
      audioIds: ["audio-1"],
      createdAt: 1,
      updatedAt: 2,
    });

    await syncJournalAudio({
      id: "audio-1",
      entryId: "entry-1",
      duration: 15,
      mimeType: "audio/webm",
      createdAt: 1,
      storagePath: "user-1/entry-1/audio-1.webm",
    }, "user-1");

    expect(mocks.journalEntryGet).toHaveBeenCalledWith("entry-1");
    expect(mocks.writeEventAndBroadcast).toHaveBeenCalledWith(
      "journal",
      "entry-1",
      "upsert",
      expect.objectContaining({
        id: "entry-1",
        audioIds: ["audio-1"],
      }),
      "device-1",
      { expectedOwnerUserId: "user-1" },
    );
    expect(JSON.stringify(mocks.writeEventAndBroadcast.mock.calls)).not.toContain(
      "data:audio",
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
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new TypeError("Failed to fetch") });

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

  it("deletes semantic embeddings with the journal entry", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "complete", error: null });

    await deleteJournalEntryFromCloud("entry-private", "user-1");

    expect(mocks.rpc).toHaveBeenCalledWith("delete_journal_entry_permanently", {
      p_device_id: "device-1",
      p_entry_id: "entry-private",
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("rejects the entry delete when the atomic server transaction fails", async () => {
    const deleteError = new Error("journal entry transaction failed");
    mocks.rpc.mockResolvedValueOnce({ data: null, error: deleteError });

    await expect(deleteJournalEntryFromCloud("entry-photo-failure", "user-1")).rejects.toBe(
      deleteError,
    );
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("rejects the entry delete while the password-removal fence is paused", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "paused", error: null });

    await expect(
      deleteJournalEntryFromCloud("entry-audio-failure", "user-1"),
    ).rejects.toThrow("could not be committed atomically");
    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("rejects an aborted journal mutation so a durable queue action is not acknowledged", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    mocks.isAbortError.mockImplementation((error) => error === abortError);
    const maybeSingle = vi.fn(() => Promise.reject(abortError));
    const select = vi.fn(() => ({ maybeSingle }));
    mocks.from.mockReturnValue({ upsert: vi.fn(() => ({ select })) });

    await expect(
      syncJournalEntry(
        {
          id: "entry-aborted",
          date: "2026-07-13",
          title: "Durable",
          content: "Must remain queued",
          stickers: [],
          tags: [],
          photoIds: [],
          createdAt: 1,
          updatedAt: 2,
        },
        "user-1"
      )
    ).rejects.toBe(abortError);

    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("forwards the queue AbortSignal to the journal PostgREST request", async () => {
    const controller = new AbortController();
    const maybeSingle = vi.fn(() => Promise.resolve({ data: { id: "entry-signal" }, error: null }));
    const abortSignal = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ abortSignal, maybeSingle }));
    mocks.from.mockReturnValue({ upsert: vi.fn(() => ({ select })) });

    await syncJournalEntry(
      {
        id: "entry-signal",
        date: "2026-07-14",
        title: "Signal",
        content: "Abortable queue request",
        stickers: [],
        tags: [],
        photoIds: [],
        createdAt: 1,
        updatedAt: 2,
      },
      "user-1",
      controller.signal,
    );

    expect(abortSignal).toHaveBeenCalledWith(controller.signal);
  });

  it("rejects aborted photo and audio metadata mutations", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    mocks.isAbortError.mockImplementation((error) => error === abortError);
    mocks.from.mockReturnValue({ upsert: vi.fn(() => Promise.reject(abortError)) });

    await expect(
      syncJournalPhoto({
        id: "photo-aborted",
        entryId: "entry-1",
        width: 640,
        height: 480,
        createdAt: 1,
      }, "user-1")
    ).rejects.toBe(abortError);
    await expect(
      syncJournalAudio({
        id: "audio-aborted",
        entryId: "entry-1",
        duration: 10,
        mimeType: "audio/webm",
        createdAt: 1,
      }, "user-1")
    ).rejects.toBe(abortError);
  });

  it("rejects aborted entry and media deletes", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    mocks.isAbortError.mockImplementation((error) => error === abortError);
    const rejectDelete = () => ({
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ eq: vi.fn(() => Promise.reject(abortError)) })),
      })),
    });
    mocks.from.mockImplementation(rejectDelete);
    mocks.rpc.mockRejectedValueOnce(abortError);

    await expect(deleteJournalEntryFromCloud("entry-aborted", "user-1")).rejects.toBe(abortError);
    await expect(deleteJournalPhotoFromCloud("photo-aborted", "user-1")).rejects.toBe(abortError);
    await expect(deleteJournalAudioFromCloud("audio-aborted", "user-1")).rejects.toBe(abortError);
  });

  it("returns an explicit acknowledgement for required entry, photo, and audio commits", async () => {
    const maybeSingle = vi.fn(() => Promise.resolve({ data: { id: "remote-row" }, error: null }));
    const select = vi.fn(() => ({ maybeSingle }));
    mocks.from.mockReturnValue({ upsert: vi.fn(() => ({ select })) });

    await expect(
      syncJournalEntry(
        {
          id: "entry-required",
          date: "2026-08-03",
          title: "Required",
          content: "Local fixture content",
          stickers: [],
          tags: [],
          photoIds: [],
          createdAt: 1,
          updatedAt: 2,
        },
        { expectedOwnerUserId: "user-1", requireRemoteCommit: true },
      ),
    ).resolves.toEqual({ status: "committed" });

    await expect(
      syncJournalPhoto(
        {
          id: "photo-required",
          entryId: "entry-required",
          width: 640,
          height: 480,
          createdAt: 1,
        },
        { expectedOwnerUserId: "user-1", requireRemoteCommit: true },
      ),
    ).resolves.toEqual({ status: "committed" });

    await expect(
      syncJournalAudio(
        {
          id: "audio-required",
          entryId: "entry-required",
          duration: 10,
          mimeType: "audio/webm",
          createdAt: 1,
        },
        { expectedOwnerUserId: "user-1", requireRemoteCommit: true },
      ),
    ).resolves.toEqual({ status: "committed" });
  });

  it("rejects queued delivery when a remote commit is required", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    const required = { expectedOwnerUserId: "user-1", requireRemoteCommit: true } as const;
    const entry = {
      id: "entry-offline-required",
      date: "2026-08-03",
      title: "Offline",
      content: "Local fixture content",
      stickers: [],
      tags: [],
      photoIds: [],
      createdAt: 1,
      updatedAt: 2,
    };

    await expect(syncJournalEntry(entry, required)).rejects.toMatchObject({
      name: "RequiredRemoteCommitError",
      outcome: "queued",
    });
    await expect(
      syncJournalPhoto(
        {
          id: "photo-offline-required",
          entryId: entry.id,
          width: 640,
          height: 480,
          createdAt: 1,
        },
        required,
      ),
    ).rejects.toMatchObject({ name: "RequiredRemoteCommitError", outcome: "queued" });
    await expect(
      syncJournalAudio(
        {
          id: "audio-offline-required",
          entryId: entry.id,
          duration: 10,
          mimeType: "audio/webm",
          createdAt: 1,
        },
        required,
      ),
    ).rejects.toMatchObject({ name: "RequiredRemoteCommitError", outcome: "queued" });

    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects no-op delivery when cloud sync is disabled", async () => {
    mocks.isCloudSyncEnabled.mockReturnValue(false);
    const required = { expectedOwnerUserId: "user-1", requireRemoteCommit: true } as const;

    await expect(
      syncJournalEntry(
        {
          id: "entry-disabled-required",
          date: "2026-08-03",
          title: "Disabled",
          content: "Local fixture content",
          stickers: [],
          tags: [],
          photoIds: [],
          createdAt: 1,
          updatedAt: 2,
        },
        required,
      ),
    ).rejects.toMatchObject({ name: "RequiredRemoteCommitError", outcome: "no-op" });
    await expect(
      syncJournalPhoto(
        {
          id: "photo-disabled-required",
          entryId: "entry-disabled-required",
          width: 640,
          height: 480,
          createdAt: 1,
        },
        required,
      ),
    ).rejects.toMatchObject({ name: "RequiredRemoteCommitError", outcome: "no-op" });
    await expect(
      syncJournalAudio(
        {
          id: "audio-disabled-required",
          entryId: "entry-disabled-required",
          duration: 10,
          mimeType: "audio/webm",
          createdAt: 1,
        },
        required,
      ),
    ).rejects.toMatchObject({ name: "RequiredRemoteCommitError", outcome: "no-op" });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("rejects stale and zero-row required commits", async () => {
    const staleEntryMaybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const zeroRowMediaMaybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    mocks.from.mockImplementation((table: string) => ({
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle:
            table === "journal_entries" ? staleEntryMaybeSingle : zeroRowMediaMaybeSingle,
        })),
      })),
    }));
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const required = { expectedOwnerUserId: "user-1", requireRemoteCommit: true } as const;

    await expect(
      syncJournalEntry(
        {
          id: "entry-stale-required",
          date: "2026-08-03",
          title: "Stale",
          content: "Local fixture content",
          stickers: [],
          tags: [],
          photoIds: [],
          createdAt: 1,
          updatedAt: 2,
        },
        required,
      ),
    ).rejects.toMatchObject({ name: "RequiredRemoteCommitError", outcome: "stale" });
    await expect(
      syncJournalPhoto(
        {
          id: "photo-zero-row",
          entryId: "entry-required",
          width: 640,
          height: 480,
          createdAt: 1,
        },
        required,
      ),
    ).rejects.toMatchObject({ name: "RequiredRemoteCommitError", outcome: "no-op" });
    await expect(
      syncJournalAudio(
        {
          id: "audio-zero-row",
          entryId: "entry-required",
          duration: 10,
          mimeType: "audio/webm",
          createdAt: 1,
        },
        required,
      ),
    ).rejects.toMatchObject({ name: "RequiredRemoteCommitError", outcome: "no-op" });

    expect(mocks.writeEventAndBroadcast).not.toHaveBeenCalled();
  });

  it("rejects aborted required entry and media commits", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    const controller = new AbortController();
    controller.abort(abortError);
    const required = {
      expectedOwnerUserId: "user-1",
      requireRemoteCommit: true,
      signal: controller.signal,
    } as const;

    await expect(
      syncJournalEntry(
        {
          id: "entry-required-abort",
          date: "2026-08-03",
          title: "Abort",
          content: "Local fixture content",
          stickers: [],
          tags: [],
          photoIds: [],
          createdAt: 1,
          updatedAt: 2,
        },
        required,
      ),
    ).rejects.toMatchObject({ name: "RequiredRemoteCommitError", outcome: "aborted" });
    await expect(
      syncJournalPhoto(
        {
          id: "photo-required-abort",
          entryId: "entry-required-abort",
          width: 640,
          height: 480,
          createdAt: 1,
        },
        required,
      ),
    ).rejects.toMatchObject({ name: "RequiredRemoteCommitError", outcome: "aborted" });
    await expect(
      syncJournalAudio(
        {
          id: "audio-required-abort",
          entryId: "entry-required-abort",
          duration: 10,
          mimeType: "audio/webm",
          createdAt: 1,
        },
        required,
      ),
    ).rejects.toMatchObject({ name: "RequiredRemoteCommitError", outcome: "aborted" });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
