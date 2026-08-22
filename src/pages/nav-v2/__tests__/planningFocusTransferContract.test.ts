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
    const cosmicBackground = read("src/components/focus-timer/CosmicBackground.tsx");
    const useFocusTimer = read("src/hooks/useFocusTimer.ts");

    expect(focusTimer).toContain('import { HyperfocusMode } from "../HyperfocusMode";');
    expect(focusTimer).toContain("<FocusReflectionModal");
    expect(focusTimer).toContain("<HyperfocusMode");
    expect(focusTimer).toContain("onShowHyperfocus={() => setShowHyperfocus(true)}");
    expect(focusTimer).toContain("hyperfocusMode: t.hyperfocusMode");

    expect(timerControls).toContain("onShowHyperfocus");
    expect(timerControls).toContain("disabled={isRunning}");
    expect(timerControls).toContain("{labels.hyperfocusMode}");
    expect(timerControls).toContain("import { Play, Pause, RotateCcw, Focus }");
    expect(timerControls).toContain("useShouldAnimate");
    expect(timerControls).toContain("motionAllowed && !isRunning");
    expect(timerControls).toContain("whileHover={motionAllowed ?");
    expect(timerControls).toContain("<Focus");
    expect(timerControls).not.toContain("Zap");

    expect(cosmicBackground).toContain("import { Focus }");
    expect(cosmicBackground).toContain("<Focus");
    expect(cosmicBackground).not.toContain("Sparkles");
    expect(cosmicBackground).not.toContain("Zap");

    expect(useFocusTimer).toContain("const [showHyperfocus, setShowHyperfocus] = useState(false);");
    expect(useFocusTimer).toContain("const handleHyperfocusComplete = () =>");
    expect(useFocusTimer).toContain("setPendingSession(session);");
    expect(useFocusTimer).toContain("setShowReflection(true);");
    expect(useFocusTimer).not.toContain("onCompleteSession(session);\n  };\n\n  useBackHandler(showReflection");
    expect(useFocusTimer).toContain("setFocusControls({ toggle: throttledToggle, reset: throttledReset });");
  });

  it("keeps Hyperfocus on the restored local night scope without restoring V1", () => {
    const hyperfocusMode = read("src/components/hyperfocus/HyperfocusMode.tsx");
    const hyperfocusBackground = read("src/components/hyperfocus/HyperfocusBackground.tsx");
    const hyperfocusSoundSelector = read("src/components/hyperfocus/HyperfocusSoundSelector.tsx");
    const indexCss = read("src/index.css");
    const cosmicBackgroundCss =
      /\.zf-hyperfocus-cosmic-background\s*\{([\s\S]*?)\}/.exec(indexCss)?.[1] ?? "";
    const nebulaCss = /\.zf-hyperfocus-nebula\s*\{([\s\S]*?)\}/.exec(indexCss)?.[1] ?? "";

    expect(hyperfocusMode).toContain('data-hyperfocus-theme="night"');
    expect(hyperfocusMode).toContain('className="dark fixed inset-y-0 left-0');
    expect(hyperfocusMode).toContain("w-screen");
    expect(hyperfocusMode).toContain("max-w-none");
    expect(hyperfocusMode).toContain("overflow-y-auto overscroll-contain scrollbar-hide");
    expect(hyperfocusMode).toContain("document.documentElement");
    expect(hyperfocusMode).toContain("scrollbar-gutter");
    expect(hyperfocusMode).toContain("previousScrollbarGutter");
    expect(hyperfocusMode).toContain("[@media(min-height:980px)]:block");
    expect(hyperfocusMode).toContain("Play, Pause, Shield, Music, Leaf");
    expect(hyperfocusMode).toContain("useShouldAnimate");
    expect(hyperfocusMode).toContain("motionAllowed");
    expect(hyperfocusMode).toContain("motionAllowed && (");
    expect(hyperfocusMode).toContain("motionAllowed ? { height:");
    expect(hyperfocusMode).toContain("<Leaf");
    expect(hyperfocusMode).not.toContain("💡");
    expect(hyperfocusMode).not.toContain("Sparkles");
    expect(hyperfocusMode).toContain('bg-[hsl(var(--focus-cosmic-deep))]');
    expect(hyperfocusMode).toContain('text-[hsl(var(--zf-text-strong))]');
    expect(hyperfocusMode).toContain('min-h-[var(--app-viewport-height)]');
    expect(hyperfocusMode).toContain('var(--safe-top)');
    expect(hyperfocusMode).toContain('var(--safe-right)');
    expect(hyperfocusMode).toContain('var(--safe-bottom)');
    expect(hyperfocusMode).toContain('pt-[calc(var(--safe-top)_+_4.75rem)]');
    expect(hyperfocusMode).toContain('pb-[calc(var(--safe-bottom)_+_2rem)]');
    expect(hyperfocusMode).not.toContain('pt-[calc(var(--safe-top)+4.75rem)]');
    expect(hyperfocusMode).not.toContain('pb-[calc(var(--safe-bottom)+2rem)]');
    expect(hyperfocusMode).not.toContain('env(safe-area-inset-top');
    expect(hyperfocusMode).not.toContain("components/v1");

    expect(hyperfocusBackground).toContain("Historical night Hyperfocus");
    expect(hyperfocusBackground).toContain(
      'className="zf-hyperfocus-cosmic-background absolute inset-0"',
    );
    expect(cosmicBackgroundCss).toContain("hsl(var(--focus-cosmic-mid))");
    expect(cosmicBackgroundCss).toContain("hsl(var(--focus-cosmic-deep))");
    expect(cosmicBackgroundCss).toContain("hsl(var(--focus-cosmic-dark))");
    expect(hyperfocusBackground).toContain(
      'className="zf-hyperfocus-nebula pointer-events-none absolute inset-0"',
    );
    expect(nebulaCss).toContain("var(--nebula-a)");
    expect(nebulaCss).toContain("var(--nebula-b)");
    expect(hyperfocusBackground).not.toContain("Light mode");
    expect(hyperfocusBackground).not.toContain("from-amber-50 via-sky-50 to-indigo-50");
    expect(hyperfocusBackground).toContain("motionAllowed");
    expect(hyperfocusBackground).toContain("useShouldAnimate");
    expect(hyperfocusBackground).toContain("motionAllowed={motionAllowed}");
    expect(hyperfocusBackground).toContain('motionAllowed ? "zen-particle absolute rounded-full" : "absolute rounded-full"');
    expect(hyperfocusBackground).toContain("motionAllowed && showBreathingAnimation");
    expect(hyperfocusBackground).not.toContain("transition={{ duration: 8, repeat: Infinity }}");

    const hyperfocusTimerDisplay = read("src/components/hyperfocus/HyperfocusTimerDisplay.tsx");
    expect(hyperfocusTimerDisplay).toContain("motionAllowed");
    expect(hyperfocusTimerDisplay).toContain("useShouldAnimate");
    expect(hyperfocusTimerDisplay).toContain("initial={motionAllowed");
    expect(hyperfocusTimerDisplay).toContain("transition={motionAllowed ? zenMotion.snappy : { duration: 0 }}");

    expect(hyperfocusSoundSelector).toContain("lg:max-w-3xl");
    expect(hyperfocusSoundSelector).toContain("lg:grid-cols-7");
    expect(hyperfocusSoundSelector).toContain("useShouldAnimate");
    expect(hyperfocusSoundSelector).toContain('motionAllowed && "animate-spin"');
    expect(hyperfocusSoundSelector).toContain("whileHover={motionAllowed ?");
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

  it("keeps schedule modals above V2 nav with attached focus traps", () => {
    const addEventModal = read("src/components/schedule/AddEventModal.tsx");
    const eventDetailsModal = read("src/components/schedule/EventDetailsModal.tsx");
    const scheduleTimeline = read("src/components/schedule/ScheduleTimeline.tsx");

    expect(addEventModal).toContain("const { modalRef, handleKeyDown } = useModalA11y(true, onClose);");
    expect(addEventModal).toContain("ref={modalRef}");
    expect(addEventModal).toContain("onKeyDown={handleKeyDown}");
    expect(addEventModal).toContain("z-[60]");

    expect(eventDetailsModal).toContain("const { modalRef, handleKeyDown } = useModalA11y(true, onClose);");
    expect(eventDetailsModal).toContain("ref={modalRef}");
    expect(eventDetailsModal).toContain("onKeyDown={handleKeyDown}");
    expect(eventDetailsModal).toContain("z-[60]");
    expect(scheduleTimeline).toContain("<AddEventModal");
    expect(scheduleTimeline).toContain("<EventDetailsModal");
    expect(scheduleTimeline.match(/forceDark/g)).toHaveLength(2);
  });

  it("lets the Add Event dialog use the full resized Android viewport", () => {
    const addEventModal = read("src/components/schedule/AddEventModal.tsx");

    expect(addEventModal).toContain(
      '"fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center"',
    );
    expect(addEventModal).toContain(
      "pb-[max(1rem,var(--safe-bottom))]",
    );
    expect(addEventModal).not.toContain("mb-[var(--nav-height)]");
    expect(addEventModal).not.toContain("pb-[calc(var(--nav-height)+var(--safe-bottom))]");
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
