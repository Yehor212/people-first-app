import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("JournalEntryCard search highlighting", () => {
  it("does not build a RegExp from the user search query", () => {
    const source = readFileSync("src/features/journal/JournalEntryCard.tsx", "utf8");

    expect(source).not.toContain("new RegExp");
    expect(source).not.toContain("escapeRegex");
  });
});
