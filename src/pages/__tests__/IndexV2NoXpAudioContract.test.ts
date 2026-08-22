import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Index V2 no-XP audio contract", () => {
  it("keeps V2 completion feedback out of XP and reward audio pathways", () => {
    const indexSource = readFileSync("src/pages/Index.tsx", "utf8");
    const moodSource = readFileSync("src/hooks/useMoodHandlers.ts", "utf8");
    const focusSource = readFileSync("src/hooks/useFocusHandlers.ts", "utf8");
    const gratitudeSource = readFileSync("src/hooks/useGratitudeHandlers.ts", "utf8");
    const orchestratorSource = readFileSync(
      "src/components/navigation-v2/NavV2Orchestrator.tsx",
      "utf8",
    );
    const navInvocation = indexSource.match(/<NavV2Orchestrator[\s\S]*?\/>/)?.[0] ?? "";
    const navProps =
      orchestratorSource.match(/interface NavV2OrchestratorProps \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(indexSource).toContain("const V2_REWARDS_ENABLED = false");
    expect(indexSource).toContain("useGamification({ enabled: V2_REWARDS_ENABLED })");
    expect(indexSource).toMatch(/useMoodHandlers\(\{[\s\S]*rewardsEnabled: V2_REWARDS_ENABLED/);
    expect(indexSource).toMatch(/useFocusHandlers\(\{[\s\S]*rewardsEnabled: V2_REWARDS_ENABLED/);
    expect(indexSource).toMatch(/useGratitudeHandlers\(\{[\s\S]*rewardsEnabled: V2_REWARDS_ENABLED/);
    expect(navInvocation).not.toBe("");
    expect(navProps).not.toBe("");
    expect(navInvocation).not.toMatch(/\bonEarn(?:Xp|Treats)\s*=/);
    expect(navProps).not.toMatch(/\bonEarn(?:Xp|Treats)\??:/);
    expect(indexSource).not.toContain("onEarnXp");
    expect(orchestratorSource).not.toContain("onEarnXp");
    expect(indexSource).not.toContain("onEarnTreats");
    expect(orchestratorSource).not.toContain("onEarnTreats");

    expect(moodSource).toContain("if (rewardsEnabled)");
    expect(moodSource).toContain("playSound(\"success\")");
    expect(focusSource).toContain("if (rewardsEnabled)");
    expect(focusSource).toContain("playSound(\"complete\")");
    expect(gratitudeSource).toContain("if (rewardsEnabled)");
    expect(gratitudeSource).toContain("playSound(\"success\")");
  });
});
