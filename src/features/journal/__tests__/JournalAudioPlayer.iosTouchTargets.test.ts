import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/features/journal/JournalAudioPlayer.tsx", "utf8");

describe("JournalAudioPlayer iOS touch targets", () => {
  it("keeps play and pause control at least 44px on iOS", () => {
    const buttonStart = source.indexOf("<button");
    const buttonEnd = source.indexOf("</button>", buttonStart);
    const buttonSource = source.slice(buttonStart, buttonEnd);

    expect(buttonSource).toContain("min-h-[44px]");
    expect(buttonSource).toContain("min-w-[44px]");
    expect(buttonSource).not.toContain("w-9 h-9");
  });
});
