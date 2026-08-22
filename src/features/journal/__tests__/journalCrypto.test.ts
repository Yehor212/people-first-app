import { describe, expect, it } from "vitest";

import {
  decryptJournalContent,
  decryptJournalContentIfNeeded,
  encryptJournalContent,
  isEncryptedJournalContent,
  JOURNAL_CONTENT_ENCRYPTION_PREFIX,
} from "../journalCrypto";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeTestEnvelope(encrypted: string): Record<string, unknown> {
  const payload = encrypted.slice(JOURNAL_CONTENT_ENCRYPTION_PREFIX.length);
  return JSON.parse(new TextDecoder().decode(base64ToBytes(payload))) as Record<string, unknown>;
}

function encodeTestEnvelope(envelope: Record<string, unknown>): string {
  return JOURNAL_CONTENT_ENCRYPTION_PREFIX + bytesToBase64(new TextEncoder().encode(JSON.stringify(envelope)));
}

const fixedSalt = new Uint8Array([
  1, 2, 3, 4, 5, 6, 7, 8,
  9, 10, 11, 12, 13, 14, 15, 16,
]);
const fixedIv = new Uint8Array([21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);
const testOptions = { iterations: 2, unsafeTestOnlyIvBytes: fixedIv, unsafeTestOnlySaltBytes: fixedSalt };

describe("journal content crypto envelope", () => {
  it("encrypts rich diary content into a versioned envelope and decrypts it", async () => {
    const plaintext = "<p>Private thought 🌙 & habit link</p>";

    const encrypted = await encryptJournalContent(plaintext, "correct horse battery staple", testOptions);

    expect(encrypted).toMatch(new RegExp(`^${JOURNAL_CONTENT_ENCRYPTION_PREFIX}`));
    expect(encrypted).not.toContain("Private thought");
    expect(isEncryptedJournalContent(encrypted)).toBe(true);
    await expect(decryptJournalContent(encrypted, "correct horse battery staple")).resolves.toBe(plaintext);
  });

  it("keeps deterministic output when tests inject salt and iv", async () => {
    const first = await encryptJournalContent("same entry", "password", testOptions);
    const second = await encryptJournalContent("same entry", "password", testOptions);

    expect(first).toBe(second);
  });

  it("rejects the wrong password without returning plaintext", async () => {
    const encrypted = await encryptJournalContent("do not leak me", "right password", testOptions);

    await expect(decryptJournalContent(encrypted, "wrong password")).rejects.toThrow(/decrypt/i);
  });

  it("authenticates caller-provided associated data without storing it in plaintext", async () => {
    const encrypted = await encryptJournalContent("bound entry", "password", {
      ...testOptions,
      additionalData: "owner:transaction:source",
    });

    await expect(
      decryptJournalContent(encrypted, "password", {
        additionalData: "owner:transaction:source",
      }),
    ).resolves.toBe("bound entry");
    await expect(
      decryptJournalContent(encrypted, "password", {
        additionalData: "different-owner:transaction:source",
      }),
    ).rejects.toThrow(/decrypt/i);
    await expect(decryptJournalContent(encrypted, "password")).rejects.toThrow(/decrypt/i);
    expect(encrypted).not.toContain("owner:transaction:source");
  });

  it("preserves legacy plaintext through the migration-safe helper", async () => {
    await expect(decryptJournalContentIfNeeded("legacy plaintext", "any password")).resolves.toBe("legacy plaintext");
  });

  it("rejects encrypted envelopes with excessive PBKDF2 iterations before decrypting", async () => {
    const encrypted = await encryptJournalContent("entry", "password", testOptions);
    const envelope = decodeTestEnvelope(encrypted);
    const expensiveEnvelope = encodeTestEnvelope({ ...envelope, iterations: 600_001 });

    await expect(decryptJournalContent(expensiveEnvelope, "password")).rejects.toThrow(/iteration/i);
  });

  it("rejects malformed envelope crypto fields with specific errors", async () => {
    const encrypted = await encryptJournalContent("entry", "password", testOptions);
    const envelope = decodeTestEnvelope(encrypted);

    await expect(
      decryptJournalContent(encodeTestEnvelope({ ...envelope, salt: bytesToBase64(new Uint8Array([1])) }), "password"),
    ).rejects.toThrow(/salt/i);
    await expect(
      decryptJournalContent(encodeTestEnvelope({ ...envelope, iv: bytesToBase64(new Uint8Array([1])) }), "password"),
    ).rejects.toThrow(/iv/i);
    await expect(
      decryptJournalContent(encodeTestEnvelope({ ...envelope, ciphertext: bytesToBase64(new Uint8Array([1])) }), "password"),
    ).rejects.toThrow(/ciphertext/i);
  });
});
