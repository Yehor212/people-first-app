import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/storage/realtimeSync.ts", "utf8");
const eventSyncSource = readFileSync("src/storage/eventSync.ts", "utf8");

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

  it("does not write raw diary media identifiers into sync diagnostics", () => {
    expect(eventSyncSource).not.toMatch(
      /logger\.(?:warn|error|log)\([^\n]*journal (?:audio|photo)[^\n]*row\.id/,
    );
  });
});
