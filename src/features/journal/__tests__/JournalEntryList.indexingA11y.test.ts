import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("JournalEntryList private-search status", () => {
  it("does not announce a nonexistent embedding-index operation", () => {
    const source = readFileSync("src/features/journal/JournalEntryList.tsx", "utf8");

    expect(source).not.toContain("AI indexing banner");
    expect(source).not.toContain("generateAllMissingEmbeddingsLazy");
    expect(source).not.toContain("Building AI search index");
  });

  it("exposes private-search consent progress on the initiating control", () => {
    const source = readFileSync("src/features/journal/JournalEntryList.tsx", "utf8");
    const start = source.indexOf("ref={aiToggleButtonRef}");
    const end = source.indexOf("</button>", start);
    const control = source.slice(start, end);

    expect(control).toContain("disabled={aiConsentBusy}");
    expect(control).toContain("aria-busy={aiConsentBusy}");
  });
});
