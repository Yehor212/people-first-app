import { describe, expect, it } from "vitest";

import {
  JournalPasswordRemovalBlockedError,
  isJournalSecurityDiagnosticCode,
  normalizeJournalSecurityDiagnosticCode,
  type JournalPasswordRemovalResult,
  type JournalProtectionBlockerCode,
} from "../journalSecurityErrors";

const blockerCodes: JournalProtectionBlockerCode[] = [
  "unlock-required",
  "activation-pending",
  "removal-pending",
  "vault-revision-mismatch",
  "decrypt-entry",
  "decrypt-media",
  "decrypt-draft",
  "decrypt-space",
  "decrypt-capture",
  "owner-changed",
  "storage-failed",
];

describe("journal password removal privacy contract", () => {
  it.each(blockerCodes)("serializes blocker %s without content-bearing fields", (blocker) => {
    const result: JournalPasswordRemovalResult = {
      status: "blocked",
      blocker,
      recoveryAction: blocker === "unlock-required" ? "unlock" : "retry",
    };
    const serialized = JSON.stringify(result);

    expect(Object.keys(result).sort()).toEqual(
      ["blocker", "recoveryAction", "status"].sort(),
    );
    expect(serialized).not.toMatch(/content|ciphertext|entryId|mediaId|ownerUserId|password/i);
  });

  it("does not retain an injected provider message on the typed blocker error", () => {
    const error = new JournalPasswordRemovalBlockedError({
      status: "decrypt-entry",
      recoveryAction: "retry",
    });

    expect(error.message).toBe("Diary password removal blocked: decrypt-entry");
    expect(error).not.toHaveProperty("cause");
    expect(error).not.toHaveProperty("originalError");
  });

  it.each(["enqueue-failed", "storage-failed"] as const)(
    "accepts only stable diagnostic code %s",
    (code) => {
      expect(isJournalSecurityDiagnosticCode(code)).toBe(true);
      expect(normalizeJournalSecurityDiagnosticCode(code)).toBe(code);
    },
  );

  it.each([
    "queue full for user@example.com",
    "ciphertext: entry-enc:secret",
    "https://provider.invalid/account-a",
    new Error("raw provider failure"),
    { message: "journal content" },
  ])("drops arbitrary durable diagnostic input", (value) => {
    expect(isJournalSecurityDiagnosticCode(value)).toBe(false);
    expect(normalizeJournalSecurityDiagnosticCode(value)).toBeUndefined();
  });
});
