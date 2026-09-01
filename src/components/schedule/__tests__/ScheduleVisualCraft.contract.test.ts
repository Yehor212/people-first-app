import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const timelineSource = readSource("src/components/schedule/ScheduleTimeline.tsx");
const visualsSource = readSource("src/components/schedule/ScheduleVisuals.tsx");
const timelineDaySource = readSource("src/components/schedule/TimelineDayColumn.tsx");
const constantsSource = readSource("src/components/schedule/constants.ts");
const addEventSource = readSource("src/components/schedule/AddEventModal.tsx");
const eventDetailsSource = readSource("src/components/schedule/EventDetailsModal.tsx");
const taskFocusSource = readSource("src/components/schedule/TaskFocusPanel.tsx");
const planningPageSource = readSource("src/pages/nav-v2/planning/PlanningPage.tsx");
const planningDayPulseSource = readSource("src/pages/nav-v2/planning/PlanningDayPulse.tsx");
const planningBridgeSource = readSource("src/pages/nav-v2/planning/PlanningBridgeActions.tsx");
const planningModeRailSource = readSource("src/pages/nav-v2/planning/PlanningModeRail.tsx");
const planningActionSource = readSource("src/pages/nav-v2/planning/PlanningActionPanel.tsx");
const planningReviewSource = readSource("src/pages/nav-v2/planning/PlanningReviewLane.tsx");
const scheduleFlowSource = [
  timelineSource,
  visualsSource,
  timelineDaySource,
  addEventSource,
  eventDetailsSource,
].join("\n");
const planningFlowSource = [
  planningPageSource,
  planningDayPulseSource,
  planningBridgeSource,
  planningModeRailSource,
  planningActionSource,
  planningReviewSource,
].join("\n");

describe("Schedule visual craft contract", () => {
  it("uses one restrained semantic visual grammar for the scheduling job", () => {
    expect(scheduleFlowSource).not.toMatch(
      /ParticleBackground|Sparkles|PremiumDayPill|EventCard3D|CurrentTimeOrb/
    );
    expect(scheduleFlowSource).not.toMatch(/rotateX|rotateY|clockGradient|event-glow|event-pulse/);
    expect(scheduleFlowSource).not.toMatch(/#0f0f23|rgba\(|text-shadow|drop-shadow/);

    expect(timelineSource).toContain("border-border/50 bg-card text-card-foreground");
    expect(timelineSource).not.toContain("message={");
    expect(constantsSource).not.toMatch(/EVENT_GRADIENTS|getEventGradient|from-blue-500/);
  });

  it("uses a neutral semantic accent for the current-time marker", () => {
    const currentTimeIndicator = visualsSource.slice(
      visualsSource.indexOf("export function CurrentTimeIndicator")
    );

    expect(currentTimeIndicator).toContain("w-0.5 bg-primary");
    expect(currentTimeIndicator).not.toContain("bg-destructive");
  });

  it("keeps Planning hierarchy free of decorative glass and static nested selection rings", () => {
    expect(planningFlowSource).not.toMatch(/Sparkles|radial-gradient|backdrop-blur|shadow-sm/);
    expect(planningPageSource).not.toContain(
      "ring-2 ring-primary/70 ring-offset-2 ring-offset-background"
    );
    expect(planningDayPulseSource).not.toContain("border border-border/40 bg-secondary/45");
    expect(planningBridgeSource).not.toContain("rounded-2xl border border-border/45 bg-card/72");
  });

  it("renders schedule dialogs at the canonical modal layer outside transformed feature ancestors", () => {
    for (const source of [addEventSource, eventDetailsSource]) {
      expect(source).toContain('from "react-dom"');
      expect(source).toContain("createPortal(");
      expect(source).toContain("z-[var(--z-modal)]");
      expect(source).not.toContain("z-[60]");
    }
  });

  it("formats visible event-detail time through the active locale", () => {
    expect(eventDetailsSource).toContain("new Intl.DateTimeFormat(language");
    expect(eventDetailsSource).not.toContain('hour.toString().padStart(2, "0")');
  });

  it("keeps user-authored schedule text bidi-isolated", () => {
    expect(addEventSource).toContain('htmlFor="schedule-event-title"');
    expect(addEventSource).toContain('id="schedule-event-title"');
    expect(addEventSource).toContain("<fieldset");
    expect(addEventSource).toContain("<legend");
    expect(addEventSource).toMatch(/<input[\s\S]*?dir="auto"/);
    expect(addEventSource).toMatch(/<textarea[\s\S]*?dir="auto"/);
    expect(eventDetailsSource).toMatch(/<bdi[\s\S]*?dir="auto"[\s\S]*?\{event\.title\}/);
    expect(eventDetailsSource).toMatch(/<bdi[\s\S]*?dir="auto"[\s\S]*?\{event\.note\}/);
    expect(taskFocusSource).toMatch(/<bdi[\s\S]*?dir="auto"[\s\S]*?\{block\.title\}/);
  });

  it("uses event color as a redundant cue without white-on-palette text", () => {
    expect(taskFocusSource).toContain("borderInlineStartColor: block.color");
    expect(taskFocusSource).toContain("bg-background");
    expect(taskFocusSource).toContain("text-foreground");
    expect(taskFocusSource).not.toMatch(/text-slate-|text-white|bg-black|backdrop-blur/);
    expect(taskFocusSource).not.toContain("whileHover");
    expect(taskFocusSource).toContain(
      '<span aria-hidden="true" className="shrink-0 text-lg">📋</span>'
    );
    expect(taskFocusSource).toContain(
      '<span aria-hidden="true" className="shrink-0">{block.emoji}</span>'
    );
  });
});
