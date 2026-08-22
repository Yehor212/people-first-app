import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const TARGETS = [
  { path: "src/components/WelcomeBackModal.tsx", actionFloor: "min-h-[44px] h-auto" },
  { path: "src/components/schedule/EventDetailsModal.tsx", actionFloor: "min-h-[48px] h-auto" },
  { path: "src/components/FeatureUnlock.tsx", actionFloor: "min-h-[44px] h-auto" },
  { path: "src/components/OnboardingOverlay.tsx", actionFloor: "min-h-[44px] h-auto" },
  { path: "src/components/FocusReflectionModal.tsx", actionFloor: "min-h-[44px] h-auto" },
  { path: "src/components/MindfulMoment.tsx", actionFloor: "min-h-[44px] h-auto" },
  { path: "src/components/TimeHelper.tsx", actionFloor: "min-h-[44px] h-auto" },
] as const;

type TargetPath = (typeof TARGETS)[number]["path"];

const source = (path: TargetPath) => readFileSync(path, "utf8");

describe("legacy modal viewport recovery contract", () => {
  it.each(TARGETS)("bounds and scrolls $path inside the safe viewport", ({ path, actionFloor }) => {
    const file = source(path);

    expect(file).toContain("max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-2rem)]");
    expect(file).toContain("overflow-y-auto");
    expect(file).toContain("overscroll-contain");
    expect(file).toContain(actionFloor);
    expect(file).toContain("break-words hyphens-manual");
  });

  it("lets unbounded Welcome Back habit names and Event details wrap anywhere", () => {
    expect(source("src/components/WelcomeBackModal.tsx")).toContain("[overflow-wrap:anywhere]");
    expect(
      source("src/components/schedule/EventDetailsModal.tsx").match(/\[overflow-wrap:anywhere\]/g)
    ).toHaveLength(2);
  });

  it("lets the Welcome Back mood picker reflow as labels grow", () => {
    const welcomeBack = source("src/components/WelcomeBackModal.tsx");

    expect(welcomeBack).toContain("grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))]");
    expect(welcomeBack).toContain("min-h-[44px] h-auto rounded-xl");
    expect(welcomeBack).toContain("break-words hyphens-manual text-xs font-medium");
    expect(welcomeBack).not.toContain("grid-cols-5");
  });

  it("scales the Time Helper clock instead of fixing it at 256 pixels", () => {
    const timeHelper = source("src/components/TimeHelper.tsx");

    expect(timeHelper).toContain("aspect-square w-full max-w-64");
    expect(timeHelper).toContain('viewBox="0 0 256 256"');
    expect(timeHelper).not.toContain("w-64 h-64");
  });
});
