import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  download: vi.fn(),
  from: vi.fn(),
  getCurrentUserId: vi.fn(),
  info: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  supabase: {
    storage: {
      from: mocks.from,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import {
  deleteAudioFromStorage,
  deleteJournalMediaStoragePath,
  downloadAsBase64,
  preparePhotoForPasswordRemovalUpload,
  readJournalMediaStorageIdentity,
  uploadAudio,
  uploadEncryptedAudio,
  uploadEncryptedPhoto,
  uploadPhoto,
  uploadPreparedJournalPasswordRemovalMedia,
} from "@/storage/journalStorageService";

describe("journalStorageService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.upload.mockResolvedValue({ error: null });
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: "signed-url" }, error: null });
    mocks.download.mockResolvedValue({ data: null, error: null });
    mocks.info.mockResolvedValue({ data: null, error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.list.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue({
      createSignedUrl: mocks.createSignedUrl,
      download: mocks.download,
      info: mocks.info,
      list: mocks.list,
      remove: mocks.remove,
      upload: mocks.upload,
    });
  });

  it("never logs owner or media identifiers when a storage identity read fails", async () => {
    const { logger } = await import("@/lib/logger");
    mocks.info.mockResolvedValueOnce({
      data: null,
      error: { message: "provider failed for user-1/private-photo" },
    });

    await expect(
      readJournalMediaStorageIdentity("journal-photos", "user-1/private-photo.v9.bin", "user-1")
    ).resolves.toBeNull();

    const serializedLogs = JSON.stringify(vi.mocked(logger.warn).mock.calls);
    expect(serializedLogs).not.toContain("user-1");
    expect(serializedLogs).not.toContain("private-photo");
    expect(serializedLogs).not.toContain("provider failed");
  });

  it("never logs a protected object path or provider error when a download is rejected", async () => {
    const { logger } = await import("@/lib/logger");
    mocks.info.mockRejectedValueOnce(
      new Error("provider exposed user-1/private-audio.v9.bin"),
    );

    await expect(
      downloadAsBase64("journal-audio", "user-1/private-audio.v9.bin", "user-1"),
    ).resolves.toBeNull();

    const serializedLogs = JSON.stringify(vi.mocked(logger.warn).mock.calls);
    expect(serializedLogs).not.toContain("user-1");
    expect(serializedLogs).not.toContain("private-audio");
    expect(serializedLogs).not.toContain("provider exposed");
  });

  it("never logs a protected object path or provider error when cleanup fails", async () => {
    const { logger } = await import("@/lib/logger");
    mocks.remove.mockResolvedValueOnce({
      error: { message: "provider exposed user-1/private-photo.v9.bin" },
    });

    await expect(
      deleteJournalMediaStoragePath(
        "journal-photos",
        "user-1/private-photo.v9.bin",
        "user-1",
      ),
    ).rejects.toBeDefined();

    const serializedLogs = JSON.stringify(vi.mocked(logger.warn).mock.calls);
    expect(serializedLogs).not.toContain("user-1");
    expect(serializedLogs).not.toContain("private-photo");
    expect(serializedLogs).not.toContain("provider exposed");
  });

  it("uploads wav diary audio with a wav storage path", async () => {
    const result = await uploadAudio(
      "audio-1",
      "data:audio/wav;base64,UklGRg==",
      "audio/wav",
      "user-1"
    );

    expect(mocks.upload).toHaveBeenCalledWith(
      "user-1/audio-1.wav",
      expect.any(Blob),
      expect.objectContaining({ contentType: "audio/wav", upsert: true })
    );
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ path: "user-1/audio-1.wav", signedUrl: "" });
  });

  it("rejects an audio payload whose data URL disguises a different MIME type", async () => {
    const result = await uploadAudio(
      "audio-spoofed",
      "data:text/html;base64,PHNjcmlwdD4=",
      "audio/webm",
      "user-1"
    );

    expect(result).toBeNull();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("uploads diary photos without minting persistent signed URLs", async () => {
    const result = await uploadPhoto(
      "photo-1",
      "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
      "user-1"
    );

    expect(mocks.upload).toHaveBeenCalledWith(
      "user-1/photo-1.jpg",
      expect.any(Blob),
      expect.objectContaining({ contentType: "image/jpeg", upsert: true })
    );
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ path: "user-1/photo-1.jpg", signedUrl: "" });
  });

  it("binds a password-removal upload to the actual bytes and provider metadata", async () => {
    const prepared = await preparePhotoForPasswordRemovalUpload(
      "photo-removal",
      "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
      "user-1",
      "101:operation",
    );

    await expect(
      uploadPreparedJournalPasswordRemovalMedia(
        prepared,
        "user-1",
        "101:operation",
      ),
    ).resolves.toEqual({ path: prepared.path, signedUrl: "" });

    expect(prepared.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(mocks.upload).toHaveBeenCalledWith(
      "user-1/removal/101:operation/photo-removal.jpg",
      prepared.blob,
      {
        contentType: "image/jpeg",
        upsert: true,
        metadata: {
          zenflowSha256: prepared.contentSha256,
          zenflowEntityId: "photo-removal",
          zenflowOperationRevision: "101:operation",
          zenflowMimeType: "image/jpeg",
        },
      },
    );
  });

  it("rejects changed password-removal bytes before the network upload", async () => {
    const prepared = await preparePhotoForPasswordRemovalUpload(
      "photo-removal",
      "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
      "user-1",
      "101:operation",
    );
    const changed = {
      ...prepared,
      blob: new Blob(["changed"], { type: "image/jpeg" }),
    };

    await expect(
      uploadPreparedJournalPasswordRemovalMedia(
        changed,
        "user-1",
        "101:operation",
      ),
    ).rejects.toThrow("receipt changed");
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("refuses to upload account-A media after the authenticated account changes to B", async () => {
    mocks.getCurrentUserId.mockResolvedValue("user-b");

    await expect(
      uploadPhoto("photo-owned-by-a", "data:image/jpeg;base64,/9j/4AAQSkZJRg==", "user-a")
    ).rejects.toThrow("account boundary");
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("uploads encrypted diary media as binary payloads without persistent signed URLs", async () => {
    const photoBlob = new Blob(["encrypted-photo"], { type: "application/octet-stream" });
    const audioBlob = new Blob(["encrypted-audio"], { type: "application/octet-stream" });

    const photoResult = await uploadEncryptedPhoto("photo-1", photoBlob, "user-1", 9);
    const audioResult = await uploadEncryptedAudio("audio-1", audioBlob, "user-1", 9);

    expect(mocks.upload).toHaveBeenNthCalledWith(
      1,
      "user-1/photo-1.v9.bin",
      photoBlob,
      expect.objectContaining({ contentType: "application/octet-stream", upsert: true })
    );
    expect(mocks.upload).toHaveBeenNthCalledWith(
      2,
      "user-1/audio-1.v9.bin",
      audioBlob,
      expect.objectContaining({ contentType: "application/octet-stream", upsert: true })
    );
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
    expect(photoResult).toStrictEqual({ path: "user-1/photo-1.v9.bin", signedUrl: "" });
    expect(audioResult).toStrictEqual({ path: "user-1/audio-1.v9.bin", signedUrl: "" });
  });

  it("deletes wav diary audio and legacy bin residue", async () => {
    await deleteAudioFromStorage("audio-1", "user-1");

    expect(mocks.remove).toHaveBeenCalledWith(
      expect.arrayContaining(["user-1/audio-1.wav", "user-1/audio-1.bin"])
    );
  });

  it("discovers and deletes versioned encrypted residue for a legacy id-only action", async () => {
    mocks.list.mockResolvedValueOnce({
      data: [{ name: "audio-1.v41.bin" }, { name: "audio-10.v41.bin" }, { name: "unrelated.bin" }],
      error: null,
    });

    await deleteAudioFromStorage("audio-1", "user-1");

    expect(mocks.list).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ search: "audio-1" })
    );
    expect(mocks.remove).toHaveBeenCalledWith(expect.arrayContaining(["user-1/audio-1.v41.bin"]));
    expect(JSON.stringify(mocks.remove.mock.calls)).not.toContain("audio-10.v41.bin");
  });

  it("rejects oversized encrypted cloud audio before downloading the object", async () => {
    mocks.info.mockResolvedValueOnce({
      data: { size: 20 * 1024 * 1024 + 4096 + 1 },
      error: null,
    });
    const fileReader = vi.fn();
    vi.stubGlobal("FileReader", fileReader);

    await expect(
      downloadAsBase64("journal-audio", "user-1/audio-oversized.bin", "user-1")
    ).resolves.toBeNull();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(fileReader).not.toHaveBeenCalled();
  });

  it("rejects a cloud audio MIME mismatch before allocating a FileReader", async () => {
    mocks.info.mockResolvedValueOnce({ data: { size: 9 }, error: null });
    mocks.download.mockResolvedValueOnce({
      data: new Blob(["not audio"], { type: "text/html" }),
      error: null,
    });
    const fileReader = vi.fn();
    vi.stubGlobal("FileReader", fileReader);

    await expect(
      downloadAsBase64("journal-audio", "user-1/audio-spoofed.webm", "user-1")
    ).resolves.toBeNull();
    expect(fileReader).not.toHaveBeenCalled();
  });
});
