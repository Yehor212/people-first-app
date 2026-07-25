import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumeJournalPasswordResetProof,
  hasStoredJournalPasswordResetProof,
  persistJournalPasswordResetProofFromUrl,
} from "../journalPasswordResetHandoff";
import { SK } from "../storageKeys";

describe("journal password reset handoff", () => {
  beforeEach(() => {
    localStorage.removeItem(SK.JOURNAL_PASSWORD_RESET_PROOF);
    vi.restoreAllMocks();
  });

  it("binds one-time reset proof to the immutable authenticated user id", () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    persistJournalPasswordResetProofFromUrl(
      "https://app.example/diary?journalReset=nonce-1",
      "user-a",
    );

    expect(hasStoredJournalPasswordResetProof("nonce-1", "user-b", 60_000)).toBe(false);
    expect(localStorage.getItem(SK.JOURNAL_PASSWORD_RESET_PROOF)).toBeNull();
  });

  it("consumes only a matching nonce and authenticated user id", () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    persistJournalPasswordResetProofFromUrl(
      "https://app.example/diary?journalReset=nonce-2",
      "user-a",
    );

    expect(consumeJournalPasswordResetProof("nonce-2", "user-a", 60_000)).toBe(true);
    expect(consumeJournalPasswordResetProof("nonce-2", "user-a", 60_000)).toBe(false);
  });
});
