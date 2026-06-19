import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
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

import { deleteAudioFromStorage, uploadAudio, uploadEncryptedAudio, uploadEncryptedPhoto, uploadPhoto } from "@/storage/journalStorageService";

describe("journalStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUserId.mockResolvedValue("user-1");
    mocks.upload.mockResolvedValue({ error: null });
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: "signed-url" }, error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({
      createSignedUrl: mocks.createSignedUrl,
      remove: mocks.remove,
      upload: mocks.upload,
    });
  });

  it("uploads wav diary audio with a wav storage path", async () => {
    const result = await uploadAudio("audio-1", "data:audio/wav;base64,UklGRg==", "audio/wav");

    expect(mocks.upload).toHaveBeenCalledWith(
      "user-1/audio-1.wav",
      expect.any(Blob),
      expect.objectContaining({ contentType: "audio/wav", upsert: true }),
    );
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ path: "user-1/audio-1.wav", signedUrl: "" });
  });

  it("uploads diary photos without minting persistent signed URLs", async () => {
    const result = await uploadPhoto("photo-1", "data:image/jpeg;base64,/9j/4AAQSkZJRg==");

    expect(mocks.upload).toHaveBeenCalledWith(
      "user-1/photo-1.jpg",
      expect.any(Blob),
      expect.objectContaining({ contentType: "image/jpeg", upsert: true }),
    );
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ path: "user-1/photo-1.jpg", signedUrl: "" });
  });

  it("uploads encrypted diary media as binary payloads without persistent signed URLs", async () => {
    const photoBlob = new Blob(["encrypted-photo"], { type: "application/octet-stream" });
    const audioBlob = new Blob(["encrypted-audio"], { type: "application/octet-stream" });

    const photoResult = await uploadEncryptedPhoto("photo-1", photoBlob);
    const audioResult = await uploadEncryptedAudio("audio-1", audioBlob);

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
    await deleteAudioFromStorage("audio-1");

    expect(mocks.remove).toHaveBeenCalledWith(
      expect.arrayContaining(["user-1/audio-1.wav", "user-1/audio-1.bin"]),
    );
  });
});
