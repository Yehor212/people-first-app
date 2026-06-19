import { describe, expect, it } from "vitest";

import {
  generateJournalVaultKey,
  isWrappedJournalVaultKey,
  rewrapJournalVaultKey,
  unwrapJournalVaultKey,
  wrapJournalVaultKey,
} from "../journalVaultCrypto";

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

describe("journal vault key crypto", () => {
  it("generates a 256-bit base64 vault key", () => {
    const key = generateJournalVaultKey();

    expect(base64ToBytes(key)).toHaveLength(32);
    expect(generateJournalVaultKey()).not.toBe(key);
  });

  it("wraps and unwraps the vault key without exposing it in the envelope", async () => {
    const key = generateJournalVaultKey();

    const wrapped = await wrapJournalVaultKey(key, "correct horse battery staple");

    expect(isWrappedJournalVaultKey(wrapped)).toBe(true);
    expect(wrapped).not.toContain(key);
    await expect(unwrapJournalVaultKey(wrapped, "correct horse battery staple")).resolves.toBe(key);
  });

  it("rejects the wrong password", async () => {
    const key = generateJournalVaultKey();
    const wrapped = await wrapJournalVaultKey(key, "right password");

    await expect(unwrapJournalVaultKey(wrapped, "wrong password")).rejects.toThrow(/decrypt|unwrap/i);
  });

  it("rewraps the same vault key for password changes", async () => {
    const key = generateJournalVaultKey();
    const oldWrapped = await wrapJournalVaultKey(key, "old password");

    const newWrapped = await rewrapJournalVaultKey(oldWrapped, "old password", "new password");

    expect(newWrapped).not.toBe(oldWrapped);
    await expect(unwrapJournalVaultKey(newWrapped, "new password")).resolves.toBe(key);
    await expect(unwrapJournalVaultKey(newWrapped, "old password")).rejects.toThrow(/decrypt|unwrap/i);
  });

  it("rejects malformed wrapped key payloads", async () => {
    await expect(unwrapJournalVaultKey("zenflow:journal-vault-key:v1:not-json", "password")).rejects.toThrow(
      /vault key/i,
    );
  });
});
