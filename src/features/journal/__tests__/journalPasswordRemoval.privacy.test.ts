import { readFileSync } from "node:fs";
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
  "owner-adoption-pending",
  "owner-changed",
  "fresh-auth-required",
  "storage-failed",
];

describe("journal password removal privacy contract", () => {
  it("keeps diary row identifiers out of migration errors and sync diagnostics", () => {
    const migrationSource = readFileSync(
      "src/features/journal/journalSecurityMigration.ts",
      "utf8",
    );
    const syncSource = readFileSync("src/storage/sync/syncJournal.ts", "utf8");
    const authSource = readFileSync("src/hooks/useAuthSession.ts", "utf8");

    expect(migrationSource).not.toMatch(
      /new Error\(`[^`]*(?:entry|photo|audio)[^`]*\$\{(?:entryId|mediaIntent\.id|photo\.id|audio\.id)\}/i,
    );
    expect(syncSource).not.toMatch(
      /logger\.(?:log|warn|error)\([^;]*,\s*(?:entryId|photoId|audioId)\s*\)/s,
    );
    expect(authSource).not.toMatch(
      /logger\.warn\(\s*"\[Auth\] Cloud sync remains paused until diary protection is reconciled",\s*error\s*,?\s*\)/s,
    );
  });

  it.each(blockerCodes)("serializes blocker %s without content-bearing fields", (blocker) => {
    const result: JournalPasswordRemovalResult = {
      status: "blocked",
      blocker,
      recoveryAction:
        blocker === "unlock-required"
          ? "unlock"
          : blocker === "fresh-auth-required"
            ? "reauthenticate"
            : "retry",
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
