import { describe, expect, it } from "vitest";
import {
  AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_REQUIRED,
  createImportedBackupAccountClaimError,
  readImportedBackupAccountClaim,
  readImportedBackupAccountClaimLabel,
} from "@/lib/authErrors";

describe("imported-backup account claim error", () => {
  it("round-trips a Unicode account label without exposing an encoded value to the UI", () => {
    const encoded = createImportedBackupAccountClaimError("користувач@example.com", "owner-123");

    expect(encoded).not.toContain("користувач@example.com");
    expect(readImportedBackupAccountClaimLabel(encoded)).toBe("користувач@example.com");
    expect(readImportedBackupAccountClaim(encoded)).toEqual({
      accountLabel: "користувач@example.com",
      expectedOwnerUserId: "owner-123",
      state: "choice",
    });
  });

  it("round-trips a bounded recovery state", () => {
    const encoded = createImportedBackupAccountClaimError(
      "@zen_friend",
      "owner-123",
      "save-failed"
    );

    expect(readImportedBackupAccountClaim(encoded)).toEqual({
      accountLabel: "@zen_friend",
      expectedOwnerUserId: "owner-123",
      state: "save-failed",
    });
  });

  it("recognizes the legacy label-free marker but rejects lookalike errors", () => {
    expect(readImportedBackupAccountClaimLabel(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_REQUIRED)).toBe(
      ""
    );
    expect(
      readImportedBackupAccountClaimLabel(`${AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_REQUIRED}-other`)
    ).toBeNull();
  });
});
