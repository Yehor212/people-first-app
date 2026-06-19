import { describe, expect, it } from "vitest";

import {
  encryptedJournalMediaFromStorageDataUrl,
  encryptedJournalMediaToStorageBlob,
  encryptJournalMediaDataUrl,
  decryptJournalMediaDataUrlIfNeeded,
  isEncryptedJournalMediaData,
  JOURNAL_MEDIA_ENCRYPTION_PREFIX,
} from "../journalMediaCrypto";

function base64ToText(value: string): string {
  const binary = atob(value);
  return Array.from(binary, (char) => String.fromCharCode(char.charCodeAt(0))).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error || new Error("Failed to read blob"));
    reader.readAsArrayBuffer(blob);
  });
}

const vaultKey = bytesToBase64(new Uint8Array(Array.from({ length: 32 }, (_, index) => index + 1)));

describe("journal media crypto envelope", () => {
  it("encrypts and decrypts photo data URLs without preserving plaintext in the stored value", async () => {
    const photoPayload = btoa("private-photo");
    const photoDataUrl = "data:image/jpeg;base64," + photoPayload;

    const encrypted = await encryptJournalMediaDataUrl(photoDataUrl, vaultKey);

    expect(encrypted).toMatch(new RegExp("^" + JOURNAL_MEDIA_ENCRYPTION_PREFIX));
    expect(encrypted).not.toContain(photoPayload);
    expect(isEncryptedJournalMediaData(encrypted)).toBe(true);
    await expect(decryptJournalMediaDataUrlIfNeeded(encrypted, vaultKey)).resolves.toBe(photoDataUrl);
  });

  it("converts encrypted media to a binary storage payload and restores the encrypted envelope after download", async () => {
    const audioDataUrl = "data:audio/webm;base64,T0dHUEFZTE9BRA==";
    const encrypted = await encryptJournalMediaDataUrl(audioDataUrl, vaultKey);

    const blob = encryptedJournalMediaToStorageBlob(encrypted);
    const downloadedDataUrl = "data:application/octet-stream;base64," + bytesToBase64(await blobToBytes(blob));
    const restored = encryptedJournalMediaFromStorageDataUrl(downloadedDataUrl);

    expect(blob.type).toBe("application/octet-stream");
    expect(base64ToText(downloadedDataUrl.split(",")[1])).not.toContain("OGGPAYLOAD");
    expect(restored).toBe(encrypted);
    await expect(decryptJournalMediaDataUrlIfNeeded(restored, vaultKey)).resolves.toBe(audioDataUrl);
  });

  it("redacts encrypted media when no vault key is available instead of exposing ciphertext", async () => {
    const encrypted = await encryptJournalMediaDataUrl("data:image/jpeg;base64," + btoa("private-photo"), vaultKey);

    await expect(decryptJournalMediaDataUrlIfNeeded(encrypted, null)).resolves.toBe("");
  });
});
