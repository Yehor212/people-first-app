import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/storage/realtimeSync.ts", "utf8");

describe("realtimeSync diary privacy guards", () => {
  it("does not pull plaintext diary rows into a locked protected journal", () => {
    expect(source).toContain("getJournalContentVaultKey");
    expect(source).toContain("SK.JOURNAL_PASSWORD");
    expect(source).toContain("canPullJournalEntryWhileLocked");
    expect(source).toContain("isEncryptedJournalContent");
    expect(source).toContain("isEncryptedJournalMediaStoragePath");
    expect(source).toContain("pullableJournalEntriesData");
    expect(source).toContain("pullableJournalPhotosData");
    expect(source).toContain("pullableJournalAudioData");
  });
});
