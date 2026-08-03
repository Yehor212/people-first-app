import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/features/journal/JournalAudioPlayer.tsx", "utf8");

describe("JournalAudioPlayer iOS touch targets", () => {
  it("keeps play and pause control at least 48px across iOS and Android", () => {
    const buttonStart = source.indexOf("<button");
    const buttonEnd = source.indexOf("</button>", buttonStart);
    const buttonSource = source.slice(buttonStart, buttonEnd);

    expect(buttonSource).toContain("min-h-[48px]");
    expect(buttonSource).toContain("min-w-[48px]");
    expect(buttonSource).not.toContain("w-9 h-9");
  });
});
