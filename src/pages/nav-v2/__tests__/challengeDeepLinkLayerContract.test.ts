import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (fileName: string) => readFileSync(fileName, "utf8");

describe("V2 challenge deep-link render contract", () => {
  it("connects the deep-link store state to a mounted V2 challenge layer", () => {
    const handler = read("src/hooks/useDeepLinkHandler.ts");
    const layer = read("src/components/navigation-v2/V2ProgressionModalLayer.tsx");
    const orchestrator = read("src/components/navigation-v2/NavV2Orchestrator.tsx");

    expect(handler).toContain('getModalToggle("showChallengeModal")');
    expect(handler).toContain("setShowChallengeModal(true)");
    expect(layer).toContain('getFeatureAvailability("challenges")');
    expect(layer).toContain("showChallengeModal: s.showChallengeModal");
    expect(layer).toContain("challengeInvite: s.challengeInvite");
    expect(layer).toContain("challengeHabit: s.challengeHabit");
    expect(layer).toContain("<ChallengeModal");
    expect(layer).toContain("setChallengeInvite(undefined)");
    expect(layer).toContain("setChallengeHabit(undefined)");
    expect(orchestrator).toContain(
      'import { V2ProgressionModalLayer } from "./V2ProgressionModalLayer";',
    );
    expect(orchestrator).toContain("<V2ProgressionModalLayer />");
  });
});
