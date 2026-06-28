import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Planning V2 focus transfer contract", () => {
  it("keeps Planning wired to the full V1 FocusTimer surface", () => {
    const planning = read("src/pages/nav-v2/planning/PlanningPage.tsx");

    expect(planning).toContain('import("@/components/FocusTimer")');
    expect(planning).toContain("onCompleteSession={handleCompleteFocusSession}");
    expect(planning).toContain("onMinuteUpdate={setCurrentFocusMinutes}");
    expect(planning).toContain("isPrimaryCTA");
  });

  it("keeps Hyperfocus, reflection, and mini-player controls attached to FocusTimer", () => {
    const focusTimer = read("src/components/focus-timer/FocusTimer.tsx");
    const timerControls = read("src/components/focus-timer/TimerControls.tsx");
    const useFocusTimer = read("src/hooks/useFocusTimer.ts");

    expect(focusTimer).toContain('import { HyperfocusMode } from "../HyperfocusMode";');
    expect(focusTimer).toContain("<FocusReflectionModal");
    expect(focusTimer).toContain("<HyperfocusMode");
    expect(focusTimer).toContain("onShowHyperfocus={() => setShowHyperfocus(true)}");
    expect(focusTimer).toContain("hyperfocusMode: t.hyperfocusMode");

    expect(timerControls).toContain("onShowHyperfocus");
    expect(timerControls).toContain("disabled={isRunning}");
    expect(timerControls).toContain("{labels.hyperfocusMode}");

    expect(useFocusTimer).toContain("const [showHyperfocus, setShowHyperfocus] = useState(false);");
    expect(useFocusTimer).toContain("const handleHyperfocusComplete = () =>");
    expect(useFocusTimer).toContain("onCompleteSession(session);");
    expect(useFocusTimer).toContain("setFocusControls({ toggle: throttledToggle, reset: throttledReset });");
  });

  it("keeps V2 post-focus mindful moment out of V1 stats navigation", () => {
    const layer = read("src/components/navigation-v2/V2MindfulMomentLayer.tsx");
    const orchestrator = read("src/components/navigation-v2/NavV2Orchestrator.tsx");
    const index = read("src/pages/Index.tsx");

    expect(layer).toContain('trigger="focus"');
    expect(layer).not.toContain("onViewProgress");
    expect(layer).not.toContain("setActiveTab");
    expect(orchestrator).toContain("<V2MindfulMomentLayer");
    expect(index).toContain("onMindfulMomentComplete={handleMindfulMomentComplete}");
  });

  it("keeps Planning review lane local to V2 Planning without V1 stats navigation", () => {
    const planning = read("src/pages/nav-v2/planning/PlanningPage.tsx");
    const reviewLane = read("src/pages/nav-v2/planning/PlanningReviewLane.tsx");

    expect(planning).toContain("<PlanningReviewLane");
    expect(reviewLane).not.toContain("setActiveTab");
    expect(reviewLane).not.toContain("onViewProgress");
    expect(reviewLane).not.toContain("stats");
  });
});
