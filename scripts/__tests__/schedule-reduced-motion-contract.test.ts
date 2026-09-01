import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Schedule reduced-motion contract", () => {
  const timeline = read("src/components/schedule/ScheduleTimeline.tsx");
  const visuals = read("src/components/schedule/ScheduleVisuals.tsx");
  const column = read("src/components/schedule/TimelineDayColumn.tsx");

  it("keeps scheduling content independent of ambient animation owners", () => {
    const scheduleSource = timeline + visuals + column;

    expect(scheduleSource).not.toMatch(
      /ParticleBackground|AnimatedClockRing|PremiumDayPill|EventCard3D|CurrentTimeOrb/,
    );
    expect(scheduleSource).not.toContain("useShouldAnimate");
    expect(scheduleSource).toContain("ScheduleClock");
    expect(scheduleSource).toContain("ScheduleDayButton");
    expect(scheduleSource).toContain("ScheduleEventCard");
    expect(scheduleSource).toContain("CurrentTimeIndicator");
  });

  it("contains no unbounded decorative repeat loop in the schedule surface", () => {
    const scheduleSource = timeline + visuals + column;

    expect(scheduleSource).not.toMatch(/repeat:\s*Infinity/);
    expect(scheduleSource).not.toMatch(/repeat:\s*motionAllowed\s*\?/);
    expect(scheduleSource).not.toMatch(/radial-gradient|clockGradient|event-glow|event-pulse/);
  });

  it("uses CSS motion-safe transitions only for bounded state changes", () => {
    const scheduleSource = timeline + visuals + column;

    expect(scheduleSource).toContain("motion-safe:transition-colors");
    expect(scheduleSource).not.toMatch(/transition=\{\{[^}]*repeat:/);
  });
});
