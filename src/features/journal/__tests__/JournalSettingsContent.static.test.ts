import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/features/journal/JournalSettingsContent.tsx", "utf8");

describe("JournalSettingsContent visual polish", () => {
  it("places the real diary ambience control in diary settings", () => {
    expect(source).toContain('import { JournalAmbienceSetting } from "./JournalAmbienceSetting"');
    expect(source).toContain("<JournalAmbienceSetting");
  });

  it("keeps the protected diary auto-lock choice beside the diary password controls", () => {
    expect(source).toContain("LOCK_TIMEOUT_OPTIONS");
    expect(source).toContain("setAutoLockMs");
    expect(source).toContain("journalLockTimeout");
    expect(source).toContain('id="journal-auto-lock-timeout"');
  });

  it("does not repeat the private-mode title and hint inside the same settings card", () => {
    const privateModeCard =
      /<SectionCard\s+title=\{ts\.journalPrivateMode[\s\S]*?<\/SectionCard>/.exec(source)?.[0] ??
      "";

    expect(privateModeCard).toContain('aria-label={ts.journalPrivateMode || "Hide previews"}');
    expect(privateModeCard.match(/ts\.journalPrivateMode(?!Hint)/g)?.length).toBe(2);
    expect(privateModeCard.match(/ts\.journalPrivateModeHint/g)?.length).toBe(1);
  });

  it("mirrors the journal settings back arrow in RTL languages", () => {
    expect(source).toContain('className="h-4 w-4 rtl:rotate-180"');
  });
});
