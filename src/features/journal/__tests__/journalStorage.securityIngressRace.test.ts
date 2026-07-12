import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const photos = new Map<string, Record<string, unknown>>();
  const audios = new Map<string, Record<string, unknown>>();

  const photoGet = vi.fn(async (id: string) => photos.get(id));
  const audioGet = vi.fn(async (id: string) => audios.get(id));
  const photoUpdate = vi.fn(async (id: string, changes: Record<string, unknown>) => {
    const current = photos.get(id);
    if (!current) return 0;
    photos.set(id, { ...current, ...changes });
    return 1;
  });
  const audioUpdate = vi.fn(async (id: string, changes: Record<string, unknown>) => {
    const current = audios.get(id);
    if (!current) return 0;
    audios.set(id, { ...current, ...changes });
    return 1;
  });

  return {
    photos,
    audios,
    photoGet,
    audioGet,
    photoUpdate,
    audioUpdate,
    enqueue: vi.fn(() => Promise.resolve()),
    syncJournalPhoto: vi.fn(() => Promise.resolve()),
    syncJournalAudio: vi.fn(() => Promise.resolve()),
    uploadPhoto: vi.fn(() => Promise.resolve({ path: "user-1/photo-draft.jpg", signedUrl: "" })),
    uploadAudio: vi.fn(() => Promise.resolve({ path: "user-1/audio-draft.webm", signedUrl: "" })),
    uploadEncryptedPhoto: vi.fn(() =>
      Promise.resolve({ path: "user-1/photo-draft.bin", signedUrl: "" })
    ),
    uploadEncryptedAudio: vi.fn(() =>
      Promise.resolve({ path: "user-1/audio-draft.bin", signedUrl: "" })
    ),
    deleteStoragePath: vi.fn(() => Promise.resolve()),
    validateSyncOwner: vi.fn((expectedOwnerUserId?: string) =>
      Promise.resolve(expectedOwnerUserId ?? "user-1")
    ),
  };
});

vi.mock("@/storage/db", () => ({
  db: {
    journalEntries: {
      get: vi.fn(() => Promise.resolve(undefined)),
      update: vi.fn(() => Promise.resolve(0)),
    },
    journalPhotos: {
      get: mocks.photoGet,
      update: mocks.photoUpdate,
    },
    journalAudio: {
      get: mocks.audioGet,
      update: mocks.audioUpdate,
    },
    settings: {
      get: vi.fn(() => Promise.resolve(undefined)),
    },
    transaction: vi.fn(
      async (_mode: string, _tables: unknown[], operation: () => Promise<unknown>) => operation()
    ),
  },
}));

vi.mock("@/storage/realtimeSync", () => ({
  syncJournalEntry: vi.fn(() => Promise.resolve()),
  deleteJournalEntryFromCloud: vi.fn(() => Promise.resolve()),
  syncJournalPhoto: mocks.syncJournalPhoto,
  syncJournalAudio: mocks.syncJournalAudio,
  deleteJournalPhotoFromCloud: vi.fn(() => Promise.resolve()),
  deleteJournalAudioFromCloud: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/storage/cloudSync", () => ({ triggerSync: vi.fn() }));
vi.mock("@/lib/cloudSyncSettings", () => ({ isCloudSyncEnabled: () => true }));
vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: () => Promise.resolve("user-1"),
  getCurrentUserId: () => Promise.resolve("user-1"),
}));
vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: mocks.validateSyncOwner,
}));
vi.mock("@/lib/offlineQueue", () => ({ offlineQueue: { enqueue: mocks.enqueue } }));
vi.mock("@/storage/deletionTracker", () => ({
  trackDeletedJournalEntryId: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/storage/journalStorageService", () => ({
  uploadPhoto: mocks.uploadPhoto,
  uploadEncryptedPhoto: mocks.uploadEncryptedPhoto,
  uploadAudio: mocks.uploadAudio,
  uploadEncryptedAudio: mocks.uploadEncryptedAudio,
  deletePhotoFromStorage: vi.fn(() => Promise.resolve()),
  deleteAudioFromStorage: vi.fn(() => Promise.resolve()),
  deleteEntryMediaFromStorage: vi.fn(() => Promise.resolve()),
  deleteJournalMediaStoragePath: mocks.deleteStoragePath,
  downloadAsBase64: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), log: vi.fn() },
}));
vi.mock("@/lib/utils", () => ({ generateId: vi.fn(() => "generated-id") }));
vi.mock("../journalContentSession", () => ({
  getJournalContentVaultKey: () => null,
}));
vi.mock("../journalCrypto", () => ({
  encryptJournalContent: vi.fn((value: string) => Promise.resolve(value)),
  decryptJournalContentIfNeeded: vi.fn((value: string) => Promise.resolve(value)),
  isEncryptedJournalContent: vi.fn((value: string) => value.startsWith("enc-entry:")),
}));
vi.mock("../journalMediaCrypto", () => ({
  encryptJournalMediaDataUrl: vi.fn((value: string) => Promise.resolve(value)),
  decryptJournalMediaDataUrlIfNeeded: vi.fn((value: string) => Promise.resolve(value)),
  isEncryptedJournalMediaData: vi.fn((value: string) => value.startsWith("enc-media:")),
  encryptedJournalMediaToStorageBlob: vi.fn(
    (value: string) => new Blob([value], { type: "application/octet-stream" })
  ),
  encryptedJournalMediaFromStorageDataUrl: vi.fn((value: string) => value),
}));

import { commitDraftMediaToEntry } from "../journalStorage";
import { runWithJournalSecurityWriteLock } from "../journalSecurityWriteLock";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

async function flushAsyncTurns(turns = 30): Promise<void> {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve();
  }
}

function seedDraftPhoto(data = "data:image/jpeg;base64,plain"): void {
  mocks.photos.set("photo-draft", {
    id: "photo-draft",
    entryId: "__draft__",
    data,
    thumbnail: data,
    width: 100,
    height: 80,
    createdAt: 1,
  });
}

function seedDraftAudio(data = "data:audio/webm;base64,plain"): void {
  mocks.audios.set("audio-draft", {
    id: "audio-draft",
    entryId: "__draft__",
    data,
    duration: 10,
    mimeType: "audio/webm",
    createdAt: 1,
  });
}

describe("journal media security ingress races", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.photos.clear();
    mocks.audios.clear();
    mocks.uploadPhoto.mockResolvedValue({ path: "user-1/photo-draft.jpg", signedUrl: "" });
    mocks.uploadAudio.mockResolvedValue({ path: "user-1/audio-draft.webm", signedUrl: "" });
    mocks.uploadEncryptedPhoto.mockResolvedValue({
      path: "user-1/photo-draft.bin",
      signedUrl: "",
    });
    mocks.uploadEncryptedAudio.mockResolvedValue({
      path: "user-1/audio-draft.bin",
      signedUrl: "",
    });
  });

  it("waits for protection activation before relinking draft media and choosing upload payloads", async () => {
    seedDraftPhoto();
    seedDraftAudio();

    let releaseActivation!: () => void;
    let activationEntered!: () => void;
    const activationEnteredPromise = new Promise<void>((resolve) => {
      activationEntered = resolve;
    });
    const activationReleasePromise = new Promise<void>((resolve) => {
      releaseActivation = resolve;
    });
    const activation = runWithJournalSecurityWriteLock(async () => {
      activationEntered();
      await activationReleasePromise;
      seedDraftPhoto("enc-media:photo-ciphertext");
      seedDraftAudio("enc-media:audio-ciphertext");
    });
    await activationEnteredPromise;

    const commitPromise = commitDraftMediaToEntry("entry-1", {
      photoIds: ["photo-draft"],
      audioIds: ["audio-draft"],
    });
    await flushAsyncTurns();
    const localWritesDuringActivation =
      mocks.photoUpdate.mock.calls.length + mocks.audioUpdate.mock.calls.length;

    releaseActivation();
    await activation;
    await commitPromise;
    await vi.waitFor(() => {
      expect(mocks.uploadEncryptedPhoto).toHaveBeenCalledTimes(1);
      expect(mocks.uploadEncryptedAudio).toHaveBeenCalledTimes(1);
    });

    expect(localWritesDuringActivation).toBe(0);
    expect(mocks.uploadPhoto).not.toHaveBeenCalled();
    expect(mocks.uploadAudio).not.toHaveBeenCalled();
  });

  it("rejects and removes a plaintext photo upload result that finishes after activation", async () => {
    seedDraftPhoto();
    const upload = deferred<{ path: string; signedUrl: string }>();
    mocks.uploadPhoto.mockReturnValueOnce(upload.promise);

    await commitDraftMediaToEntry("entry-1", { photoIds: ["photo-draft"] });
    expect(mocks.uploadPhoto).toHaveBeenCalledTimes(1);

    await runWithJournalSecurityWriteLock(async () => {
      const current = mocks.photos.get("photo-draft");
      mocks.photos.set("photo-draft", {
        ...current,
        data: "enc-media:photo-ciphertext",
        thumbnail: "enc-media:thumb-ciphertext",
        storagePath: undefined,
      });
    });
    upload.resolve({ path: "user-1/photo-draft.jpg", signedUrl: "" });
    await vi.waitFor(() => {
      expect(mocks.deleteStoragePath).toHaveBeenCalledWith(
        "journal-photos",
        "user-1/photo-draft.jpg",
        "user-1"
      );
    });

    expect(mocks.photoUpdate.mock.calls).not.toContainEqual([
      "photo-draft",
      { storagePath: "user-1/photo-draft.jpg" },
    ]);
    expect(mocks.photos.get("photo-draft")?.storagePath).not.toBe("user-1/photo-draft.jpg");
  });

  it("rejects and removes a plaintext audio upload result that finishes after activation", async () => {
    seedDraftAudio();
    const upload = deferred<{ path: string; signedUrl: string }>();
    mocks.uploadAudio.mockReturnValueOnce(upload.promise);

    await commitDraftMediaToEntry("entry-1", { audioIds: ["audio-draft"] });
    expect(mocks.uploadAudio).toHaveBeenCalledTimes(1);

    await runWithJournalSecurityWriteLock(async () => {
      const current = mocks.audios.get("audio-draft");
      mocks.audios.set("audio-draft", {
        ...current,
        data: "enc-media:audio-ciphertext",
        storagePath: undefined,
      });
    });
    upload.resolve({ path: "user-1/audio-draft.webm", signedUrl: "" });
    await vi.waitFor(() => {
      expect(mocks.deleteStoragePath).toHaveBeenCalledWith(
        "journal-audio",
        "user-1/audio-draft.webm",
        "user-1"
      );
    });

    expect(mocks.audioUpdate.mock.calls).not.toContainEqual([
      "audio-draft",
      { storagePath: "user-1/audio-draft.webm" },
    ]);
    expect(mocks.audios.get("audio-draft")?.storagePath).not.toBe("user-1/audio-draft.webm");
  });
});
