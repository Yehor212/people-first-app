import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("journal photo upload ordering", () => {
  it("checks parent authority before a queued retry uploads binary data", () => {
    const source = readFileSync("src/features/journal/journalStorage.ts", "utf8");
    const start = source.indexOf("async function retryJournalPhotoUploadUnlocked");
    const end = source.indexOf("export function retryJournalPhotoUpload", start);
    const block = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain("getJournalPhotoParentSyncDecision");
    expect(block.indexOf("getJournalPhotoParentSyncDecision")).toBeLessThan(
      block.indexOf("uploadPhotoPayload"),
    );
    expect(block).toContain('parentDecision === "wait"');
    expect(block).toContain('parentDecision === "purge"');
  });
});
