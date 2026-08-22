import { beforeEach, describe, expect, it, vi } from "vitest";
import { SK } from "@/lib/storageKeys";
import type { JournalAudio, JournalPhoto } from "../types";

const mocks = vi.hoisted(() => ({
  audioAdd: vi.fn(() => Promise.resolve()),
  audioCount: vi.fn(() => Promise.resolve(0)),
  audioGet: vi.fn(() => Promise.resolve(undefined)),
  audioToArray: vi.fn<() => Promise<JournalAudio[]>>(() => Promise.resolve([])),
  audioUpdate: vi.fn(() => Promise.resolve(1)),
  audioWhere: vi.fn(),
  encryptedJournalMediaToStorageBlob: vi.fn(() => new Blob(["encrypted"], { type: "application/octet-stream" })),
  encryptJournalMediaDataUrl: vi.fn((data: string, key: string) => Promise.resolve("media-enc:" + key + ":" + data)),
  decryptJournalMediaDataUrlIfNeeded: vi.fn((data: string, key: string | null) =>
    Promise.resolve(key && data.startsWith("media-enc:" + key + ":") ? data.slice(("media-enc:" + key + ":").length) : ""),
  ),
  isEncryptedJournalMediaData: vi.fn((data: string) => data.startsWith("media-enc:")),
  audioFilter: vi.fn(),
  photoToArray: vi.fn<() => Promise<JournalPhoto[]>>(() => Promise.resolve([])),
  photoFilter: vi.fn(),
  photoUpdate: vi.fn(() => Promise.resolve(1)),
  transaction: vi.fn((_mode: string, _tables: unknown, fn: () => unknown) => Promise.resolve(fn())),
  syncJournalAudio: vi.fn(() => Promise.resolve()),
  syncJournalPhoto: vi.fn(() => Promise.resolve()),
  triggerSync: vi.fn(),
  uploadAudio: vi.fn(() => Promise.resolve(null)),
  uploadEncryptedAudio: vi.fn(() =>
    Promise.resolve({ path: "user-1/audio-1.v2.bin", signedUrl: "" })
  ),
  settingsGet: vi.fn<(key: string) => Promise<{ value: unknown } | undefined>>(() =>
    Promise.resolve(undefined)
  ),
}));

vi.mock("@/storage/db", () => ({
  db: {
    journalEntries: {
      get: vi.fn(() => Promise.resolve(undefined)),
      update: vi.fn(() => Promise.resolve(1)),
    },
    journalPhotos: {
      filter: mocks.photoFilter,
      toArray: mocks.photoToArray,
      update: mocks.photoUpdate,
    },
    journalAudio: {
      add: mocks.audioAdd,
      filter: mocks.audioFilter,
      get: mocks.audioGet,
      toArray: mocks.audioToArray,
      update: mocks.audioUpdate,
      where: mocks.audioWhere,
    },
    settings: {
      get: mocks.settingsGet,
    },
    transaction: mocks.transaction,
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

vi.mock("@/storage/cloudSync", () => ({ triggerSync: mocks.triggerSync }));
vi.mock("@/lib/cloudSyncSettings", () => ({ isCloudSyncEnabled: vi.fn(() => true) }));
vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: vi.fn(() => Promise.resolve("user-1")),
}));
vi.mock("@/lib/offlineQueue", () => ({ offlineQueue: { enqueue: vi.fn(() => Promise.resolve()) } }));
vi.mock("@/storage/deletionTracker", () => ({ trackDeletedJournalEntryId: vi.fn(() => Promise.resolve()) }));
vi.mock("@/storage/journalStorageService", () => ({
  uploadPhoto: vi.fn(() => Promise.resolve(null)),
  uploadEncryptedPhoto: vi.fn(() => Promise.resolve(null)),
  uploadAudio: mocks.uploadAudio,
  uploadEncryptedAudio: mocks.uploadEncryptedAudio,
  deletePhotoFromStorage: vi.fn(() => Promise.resolve()),
  deleteAudioFromStorage: vi.fn(() => Promise.resolve()),
  deleteEntryMediaFromStorage: vi.fn(() => Promise.resolve()),
  downloadAsBase64: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), log: vi.fn() } }));
vi.mock("@/lib/utils", () => ({ generateId: vi.fn(() => "audio-1") }));
vi.mock("../journalMediaCrypto", () => ({
  encryptedJournalMediaFromStorageDataUrl: vi.fn((data: string) => data),
  encryptedJournalMediaToStorageBlob: mocks.encryptedJournalMediaToStorageBlob,
  encryptJournalMediaDataUrl: mocks.encryptJournalMediaDataUrl,
  decryptJournalMediaDataUrlIfNeeded: mocks.decryptJournalMediaDataUrlIfNeeded,
  isEncryptedJournalMediaData: mocks.isEncryptedJournalMediaData,
}));

import { setJournalContentVaultKey } from "../journalContentSession";
import {
  decryptEncryptedJournalMedia,
  encryptPlaintextJournalMedia,
  getAudioForEntry,
  hasEncryptedJournalMedia,
  storeAudio,
} from "../journalStorage";

const vaultKey = "vault-key";

function mockProtectedVault(): void {
  mocks.settingsGet.mockImplementation((key: string) =>
    Promise.resolve(
      key === SK.JOURNAL_VAULT_KEY
        ? {
            value: { wrappedKey: "persisted", createdAt: 1, updatedAt: 2 },
          }
        : undefined,
    ),
  );
}

describe("journalStorage media encryption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setJournalContentVaultKey(null);
    mocks.settingsGet.mockResolvedValue(undefined);
    mocks.audioWhere.mockReturnValue({
      equals: vi.fn(() => ({
        count: mocks.audioCount,
        toArray: mocks.audioToArray,
      })),
    });
    mocks.photoFilter.mockImplementation((predicate: (photo: JournalPhoto) => boolean) => ({
      first: vi.fn(() =>
        Promise.resolve([
          {
            id: "photo-plain",
            entryId: "entry-1",
            data: "data:image/jpeg;base64,photo",
            thumbnail: "data:image/jpeg;base64,thumb",
            width: 100,
            height: 80,
            createdAt: 1,
          },
        ].find(predicate)),
      ),
    }));
    mocks.audioFilter.mockImplementation((predicate: (audio: JournalAudio) => boolean) => ({
      first: vi.fn(() =>
        Promise.resolve([
          {
            id: "audio-encrypted",
            entryId: "entry-1",
            data: "media-enc:" + vaultKey + ":data:audio/webm;base64,dm9pY2U=",
            duration: 12,
            mimeType: "audio/webm",
            createdAt: 1,
          },
        ].find(predicate)),
      ),
    }));
  });

  it("stores encrypted audio locally and uploads the encrypted payload while returning plaintext to the UI", async () => {
    setJournalContentVaultKey(vaultKey, 2);
    mockProtectedVault();

    const result = await storeAudio("entry-1", "data:audio/webm;base64,dm9pY2U=", 12, "audio/webm");
    await Promise.resolve();
    await Promise.resolve();

    expect(result.data).toBe("data:audio/webm;base64,dm9pY2U=");
    expect(mocks.audioAdd).toHaveBeenCalledWith(expect.objectContaining({
      id: "audio-1",
      data: "media-enc:" + vaultKey + ":data:audio/webm;base64,dm9pY2U=",
    }));
    expect(mocks.uploadAudio).not.toHaveBeenCalled();
    expect(mocks.uploadEncryptedAudio).toHaveBeenCalledWith(
      "audio-1",
      expect.any(Blob),
      "user-1",
      2,
    );
  });

  it("decrypts encrypted audio only when the session vault key is available", async () => {
    mocks.audioToArray.mockResolvedValue([
      {
        id: "audio-1",
        entryId: "entry-1",
        data: "media-enc:" + vaultKey + ":data:audio/webm;base64,dm9pY2U=",
        duration: 12,
        mimeType: "audio/webm",
        createdAt: 1,
      },
    ]);
    setJournalContentVaultKey(vaultKey);

    await expect(getAudioForEntry("entry-1")).resolves.toEqual([
      expect.objectContaining({ data: "data:audio/webm;base64,dm9pY2U=" }),
    ]);

    setJournalContentVaultKey(null);
    await expect(getAudioForEntry("entry-1")).resolves.toEqual([
      expect.objectContaining({ data: "" }),
    ]);
  });

  it("clears stale plaintext storage paths while encrypting local media", async () => {
    mocks.photoToArray.mockResolvedValue([
      {
        id: "photo-1",
        entryId: "entry-1",
        data: "data:image/jpeg;base64,photo",
        thumbnail: "data:image/jpeg;base64,thumb",
        width: 100,
        height: 80,
        createdAt: 1,
        storagePath: "user-1/photo-1.jpg",
      },
    ]);
    mocks.audioToArray.mockResolvedValue([
      {
        id: "audio-1",
        entryId: "entry-1",
        data: "data:audio/webm;base64,dm9pY2U=",
        duration: 12,
        mimeType: "audio/webm",
        createdAt: 1,
        storagePath: "user-1/audio-1.webm",
      },
    ]);

    await encryptPlaintextJournalMedia(vaultKey);

    expect(mocks.photoUpdate).toHaveBeenCalledWith("photo-1", expect.objectContaining({
      data: "media-enc:" + vaultKey + ":data:image/jpeg;base64,photo",
      thumbnail: "media-enc:" + vaultKey + ":data:image/jpeg;base64,thumb",
      storagePath: undefined,
    }));
    expect(mocks.audioUpdate).toHaveBeenCalledWith("audio-1", expect.objectContaining({
      data: "media-enc:" + vaultKey + ":data:audio/webm;base64,dm9pY2U=",
      storagePath: undefined,
    }));
  });

  it("clears stale encrypted storage paths while decrypting local media", async () => {
    mocks.photoToArray.mockResolvedValue([
      {
        id: "photo-1",
        entryId: "entry-1",
        data: "media-enc:" + vaultKey + ":data:image/jpeg;base64,photo",
        thumbnail: "media-enc:" + vaultKey + ":data:image/jpeg;base64,thumb",
        width: 100,
        height: 80,
        createdAt: 1,
        storagePath: "user-1/photo-1.bin",
      },
    ]);
    mocks.audioToArray.mockResolvedValue([
      {
        id: "audio-1",
        entryId: "entry-1",
        data: "media-enc:" + vaultKey + ":data:audio/webm;base64,dm9pY2U=",
        duration: 12,
        mimeType: "audio/webm",
        createdAt: 1,
        storagePath: "user-1/audio-1.bin",
      },
    ]);

    await decryptEncryptedJournalMedia(vaultKey);

    expect(mocks.photoUpdate).toHaveBeenCalledWith("photo-1", expect.objectContaining({
      data: "data:image/jpeg;base64,photo",
      thumbnail: "data:image/jpeg;base64,thumb",
      storagePath: undefined,
    }));
    expect(mocks.audioUpdate).toHaveBeenCalledWith("audio-1", expect.objectContaining({
      data: "data:audio/webm;base64,dm9pY2U=",
      storagePath: undefined,
    }));
  });

  it("detects encrypted media without materializing all local media rows", async () => {
    await expect(hasEncryptedJournalMedia()).resolves.toBe(true);

    expect(mocks.photoFilter).toHaveBeenCalledTimes(1);
    expect(mocks.audioFilter).toHaveBeenCalledTimes(1);
    expect(mocks.photoToArray).not.toHaveBeenCalled();
    expect(mocks.audioToArray).not.toHaveBeenCalled();
  });

  it("migrates plaintext stored media to encrypted rows", async () => {
    mocks.photoToArray.mockResolvedValue([
      {
        id: "photo-1",
        entryId: "entry-1",
        data: "data:image/jpeg;base64,photo",
        thumbnail: "data:image/jpeg;base64,thumb",
        width: 100,
        height: 80,
        createdAt: 1,
      },
    ]);
    mocks.audioToArray.mockResolvedValue([
      {
        id: "audio-1",
        entryId: "entry-1",
        data: "data:audio/webm;base64,dm9pY2U=",
        duration: 12,
        mimeType: "audio/webm",
        createdAt: 1,
      },
    ]);

    const migrated = await encryptPlaintextJournalMedia(vaultKey);

    expect(migrated).toBe(2);
    expect(mocks.photoUpdate).toHaveBeenCalledWith("photo-1", expect.objectContaining({
      data: "media-enc:" + vaultKey + ":data:image/jpeg;base64,photo",
      thumbnail: "media-enc:" + vaultKey + ":data:image/jpeg;base64,thumb",
    }));
    expect(mocks.audioUpdate).toHaveBeenCalledWith("audio-1", expect.objectContaining({
      data: "media-enc:" + vaultKey + ":data:audio/webm;base64,dm9pY2U=",
    }));
  });
});
