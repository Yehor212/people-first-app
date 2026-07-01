import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/TimeHelper.tsx", "utf8");

describe("TimeHelper audio policy", () => {
  it("keeps ADHD time pings opt-in instead of default-on", () => {
    expect(source).toContain("useState(false)");
    expect(source).not.toContain("useState(true)");
  });

  it("uses a soft completion cue instead of the rare level-up reward sound", () => {
    expect(source).toContain("playComplete");
    expect(source).not.toContain("playLevelUp");
  });
});
