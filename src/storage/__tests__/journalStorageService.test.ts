import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  download: vi.fn(),
  from: vi.fn(),
  getCurrentUserId: vi.fn(),
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
  downloadAsBase64,
  uploadAudio,
  uploadEncryptedAudio,
  uploadEncryptedPhoto,
  uploadPhoto,
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
    mocks.remove.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({
      createSignedUrl: mocks.createSignedUrl,
      download: mocks.download,
      remove: mocks.remove,
      upload: mocks.upload,
    });
  });

  it("uploads wav diary audio with a wav storage path", async () => {
    const result = await uploadAudio(
      "audio-1",
      "data:audio/wav;base64,UklGRg==",
      "audio/wav",
      "user-1",
    );

    expect(mocks.upload).toHaveBeenCalledWith(
      "user-1/audio-1.wav",
      expect.any(Blob),
      expect.objectContaining({ contentType: "audio/wav", upsert: true }),
    );
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ path: "user-1/audio-1.wav", signedUrl: "" });
  });

  it("rejects an audio payload whose data URL disguises a different MIME type", async () => {
    const result = await uploadAudio(
      "audio-spoofed",
      "data:text/html;base64,PHNjcmlwdD4=",
      "audio/webm",
      "user-1",
    );

    expect(result).toBeNull();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("uploads diary photos without minting persistent signed URLs", async () => {
    const result = await uploadPhoto(
      "photo-1",
      "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
      "user-1",
    );

    expect(mocks.upload).toHaveBeenCalledWith(
      "user-1/photo-1.jpg",
      expect.any(Blob),
      expect.objectContaining({ contentType: "image/jpeg", upsert: true }),
    );
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ path: "user-1/photo-1.jpg", signedUrl: "" });
  });

  it("refuses to upload account-A media after the authenticated account changes to B", async () => {
    mocks.getCurrentUserId.mockResolvedValue("user-b");

    await expect(
      uploadPhoto(
        "photo-owned-by-a",
        "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        "user-a",
      ),
    ).rejects.toThrow("account boundary");
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("uploads encrypted diary media as binary payloads without persistent signed URLs", async () => {
    const photoBlob = new Blob(["encrypted-photo"], { type: "application/octet-stream" });
    const audioBlob = new Blob(["encrypted-audio"], { type: "application/octet-stream" });

    const photoResult = await uploadEncryptedPhoto("photo-1", photoBlob, "user-1");
    const audioResult = await uploadEncryptedAudio("audio-1", audioBlob, "user-1");

    expect(mocks.upload).toHaveBeenNthCalledWith(
      1,
      "user-1/photo-1.bin",
      photoBlob,
      expect.objectContaining({ contentType: "application/octet-stream", upsert: true }),
    );
    expect(mocks.upload).toHaveBeenNthCalledWith(
      2,
      "user-1/audio-1.bin",
      audioBlob,
      expect.objectContaining({ contentType: "application/octet-stream", upsert: true }),
    );
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
    expect(photoResult).toStrictEqual({ path: "user-1/photo-1.bin", signedUrl: "" });
    expect(audioResult).toStrictEqual({ path: "user-1/audio-1.bin", signedUrl: "" });
  });

  it("deletes wav diary audio and legacy bin residue", async () => {
    await deleteAudioFromStorage("audio-1", "user-1");

    expect(mocks.remove).toHaveBeenCalledWith(
      expect.arrayContaining(["user-1/audio-1.wav", "user-1/audio-1.bin"]),
    );
  });

  it("rejects oversized encrypted cloud audio before allocating a FileReader", async () => {
    const oversizedAudio = new Blob(["x"], { type: "application/octet-stream" });
    Object.defineProperty(oversizedAudio, "size", { value: 20 * 1024 * 1024 + 4096 + 1 });
    mocks.download.mockResolvedValueOnce({ data: oversizedAudio, error: null });
    const fileReader = vi.fn();
    vi.stubGlobal("FileReader", fileReader);

    await expect(
      downloadAsBase64("journal-audio", "user-1/audio-oversized.bin", "user-1"),
    ).resolves.toBeNull();
    expect(fileReader).not.toHaveBeenCalled();
  });

  it("rejects a cloud audio MIME mismatch before allocating a FileReader", async () => {
    mocks.download.mockResolvedValueOnce({
      data: new Blob(["not audio"], { type: "text/html" }),
      error: null,
    });
    const fileReader = vi.fn();
    vi.stubGlobal("FileReader", fileReader);

    await expect(
      downloadAsBase64("journal-audio", "user-1/audio-spoofed.webm", "user-1"),
    ).resolves.toBeNull();
    expect(fileReader).not.toHaveBeenCalled();
  });
});
