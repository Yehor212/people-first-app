import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Index V2 no-XP audio contract", () => {
  it("keeps V2 completion feedback out of XP and reward audio pathways", () => {
    const indexSource = readFileSync("src/pages/Index.tsx", "utf8");
    const moodSource = readFileSync("src/hooks/useMoodHandlers.ts", "utf8");
    const focusSource = readFileSync("src/hooks/useFocusHandlers.ts", "utf8");
    const gratitudeSource = readFileSync("src/hooks/useGratitudeHandlers.ts", "utf8");

    expect(indexSource).toContain("const V2_REWARDS_ENABLED = false");
    expect(indexSource).toContain("useGamification({ enabled: V2_REWARDS_ENABLED })");
    expect(indexSource).toMatch(/useMoodHandlers\(\{[\s\S]*rewardsEnabled: V2_REWARDS_ENABLED/);
    expect(indexSource).toMatch(/useFocusHandlers\(\{[\s\S]*rewardsEnabled: V2_REWARDS_ENABLED/);
    expect(indexSource).toMatch(/useGratitudeHandlers\(\{[\s\S]*rewardsEnabled: V2_REWARDS_ENABLED/);
    expect(indexSource).not.toContain("AdProvider");
    expect(indexSource).not.toContain("onEarnXp");
    expect(indexSource).not.toContain('earnTreats("ad"');

    expect(moodSource).toContain("if (rewardsEnabled)");
    expect(moodSource).toContain("playSound(\"success\")");
    expect(focusSource).toContain("if (rewardsEnabled)");
    expect(focusSource).toContain("playSound(\"complete\")");
    expect(gratitudeSource).toContain("if (rewardsEnabled)");
    expect(gratitudeSource).toContain("playSound(\"success\")");
  });
});
