import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readOnboardingFlow = () => readFileSync("src/components/OnboardingFlow.tsx", "utf8");
const readGlobalStyles = () => readFileSync("src/index.css", "utf8");

describe("OnboardingFlow text reflow contract", () => {
  it("uses content-driven module tracks that respond to the in-app text scale", () => {
    const source = readOnboardingFlow();

    expect(source).toContain(
      "grid-cols-[repeat(auto-fit,minmax(min(100%,calc(10rem*var(--font-scale,1))),1fr))]"
    );
    expect(source).not.toContain('className="grid grid-cols-2 gap-3');
    expect(source).not.toContain("text-[10px]");
    expect(source).toContain("min-w-0 whitespace-normal break-words");
  });

  it("stacks the onboarding actions on narrow screens", () => {
    const source = readOnboardingFlow();

    expect(source).toMatch(/flex[^"]*flex-col[^"]*gap-2[^"]*sm:flex-row/);
    expect(source).toContain("h-auto min-h-12 w-full min-w-0");
  });

  it("keeps fullscreen onboarding content inside lateral safe areas", () => {
    const css = readGlobalStyles();
    const overlayRule = css.slice(
      css.indexOf(".screen-overlay"),
      css.indexOf("/* Safe-area padding utilities"),
    );

    expect(overlayRule).toContain("padding-left: var(--safe-left)");
    expect(overlayRule).toContain("padding-right: var(--safe-right)");
  });
});
