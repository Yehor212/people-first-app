import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/features/journal/JournalSettingsContent.tsx", "utf8");

describe("JournalSettingsContent visual polish", () => {
  it("does not repeat the private-mode title and hint inside the same settings card", () => {
    const privateModeCard =
      /<SectionCard\s+title=\{ts\.journalPrivateMode[\s\S]*?<\/SectionCard>/.exec(source)?.[0] ??
      "";

    expect(privateModeCard).toContain('aria-label={ts.journalPrivateMode || "Hide previews"}');
    expect(privateModeCard.match(/ts\.journalPrivateMode(?!Hint)/g)?.length).toBe(2);
    expect(privateModeCard.match(/ts\.journalPrivateModeHint/g)?.length).toBe(1);
  });
});
