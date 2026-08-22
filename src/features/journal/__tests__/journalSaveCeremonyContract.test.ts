import { describe, expect, it } from "vitest";

import {
  JOURNAL_SAVE_COMMIT_RECEIPT_TTL_MS,
  commitJournalSaveAndCaptureTheme,
  createJournalSaveCommitReceipt,
  isJournalSaveCommitReceiptFresh,
  resolveJournalSaveDeliveryState,
  resolveJournalSaveCeremonyVariant,
} from "../save-ceremony/journalSaveCeremonyContract";

describe("journal save ceremony contract", () => {
  it.each([
    ["paper", "night"],
    ["ink", "day"],
    ["oled", "day"],
  ] as const)("maps the committed %s theme to the inverted %s model", (theme, expected) => {
    expect(resolveJournalSaveCeremonyVariant(theme)).toBe(expected);
  });

  it("creates a privacy-minimal in-memory receipt", () => {
    const receipt = createJournalSaveCommitReceipt({
      operation: "create",
      entryId: "entry-private-id",
      deliveryState: "cloud-pending",
      appliedTheme: "paper",
      committedAt: 1_000,
      nonce: "receipt-nonce",
    });

    expect(receipt).toEqual({
      nonce: "receipt-nonce",
      operation: "create",
      entryId: "entry-private-id",
      deliveryState: "cloud-pending",
      committedAt: 1_000,
      appliedTheme: "paper",
      variant: "night",
    });
    expect(Object.keys(receipt).sort()).toEqual(
      [
        "appliedTheme",
        "committedAt",
        "deliveryState",
        "entryId",
        "nonce",
        "operation",
        "variant",
      ].sort(),
    );
  });

  it.each([
    ["scheduled", "cloud-pending"],
    ["unavailable", "local-saved"],
  ] as const)(
    "maps a %s sync schedule to the honest %s delivery state",
    (outcome, expected) => {
      expect(resolveJournalSaveDeliveryState(() => outcome)).toBe(expected);
    },
  );

  it("keeps a durable local save successful when sync scheduling throws", () => {
    expect(
      resolveJournalSaveDeliveryState(() => {
        throw new Error("sync scheduler unavailable");
      }),
    ).toBe("cloud-failed");
  });

  it("captures the applied theme after a delayed journal commit resolves", async () => {
    let resolveCommit!: () => void;
    const commit = new Promise<void>((resolve) => {
      resolveCommit = resolve;
    });
    let appliedTheme: "paper" | "ink" = "paper";

    const result = commitJournalSaveAndCaptureTheme(
      () => commit,
      () => appliedTheme,
    );

    appliedTheme = "ink";
    resolveCommit();

    await expect(result).resolves.toEqual({
      appliedTheme: "ink",
      result: undefined,
    });
  });

  it("accepts a receipt only inside the five-second latest-use window", () => {
    const receipt = createJournalSaveCommitReceipt({
      operation: "update",
      entryId: "entry-private-id",
      deliveryState: "local-saved",
      appliedTheme: "oled",
      committedAt: 10_000,
      nonce: "receipt-nonce",
    });

    expect(isJournalSaveCommitReceiptFresh(receipt, 10_000)).toBe(true);
    expect(
      isJournalSaveCommitReceiptFresh(
        receipt,
        10_000 + JOURNAL_SAVE_COMMIT_RECEIPT_TTL_MS,
      ),
    ).toBe(true);
    expect(
      isJournalSaveCommitReceiptFresh(
        receipt,
        10_001 + JOURNAL_SAVE_COMMIT_RECEIPT_TTL_MS,
      ),
    ).toBe(false);
    expect(isJournalSaveCommitReceiptFresh(receipt, 9_999)).toBe(false);
  });
});
