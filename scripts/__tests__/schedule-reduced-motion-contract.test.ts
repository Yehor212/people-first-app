import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Schedule reduced-motion contract", () => {
  const timeline = read("src/components/schedule/ScheduleTimeline.tsx");
  const visuals = read("src/components/schedule/ScheduleVisuals.tsx");
  const column = read("src/components/schedule/TimelineDayColumn.tsx");
  const particles = read("src/components/stats/ParticleBackground.tsx");

  it("uses one reactive decision and propagates it to every ambient-motion owner", () => {
    expect(timeline).toContain('import { useShouldAnimate } from "@/hooks/useShouldAnimate"');
    expect(timeline).toContain("const motionAllowed = useShouldAnimate()");
    expect(timeline).toContain(
      '<ParticleBackground count={15} color="purple" animated={motionAllowed} />',
    );
    expect(timeline).toContain("<AnimatedClockRing");
    expect(timeline).toContain("motionAllowed={motionAllowed}");
    expect(timeline).toContain("<PremiumDayPill");
    expect(timeline).toContain("<TimelineDayColumn");
    expect(column).toContain("<EventCard3D");
    expect(column).toContain("<CurrentTimeOrb");
  });

  it("guards all eleven Motion repeat loops without changing the full-motion constants", () => {
    const scheduleSource = timeline + visuals;

    expect(scheduleSource.match(/repeat:\s*motionAllowed \? Infinity : 0/g)).toHaveLength(11);
    expect(scheduleSource).not.toMatch(/repeat:\s*Infinity/);

    for (const currentFullMotionValue of [
      'opacity: motionAllowed ? [0.3, 0.5, 0.3] : 0.3',
      'rotate: motionAllowed ? [0, 15, -15, 0] : 0',
      'scale: motionAllowed ? [1, 1.3, 1] : 1',
      '"0 0 40px rgba(139, 92, 246, 0.5)"',
      'opacity: motionAllowed ? [1, 0.8, 1] : 1',
      '"0 0 20px rgba(34, 197, 94, 0.5)"',
      'scale: motionAllowed ? [1, 1.2, 1] : 1',
      'opacity: motionAllowed ? [0.5, 1, 0.5] : 1',
      'scale: motionAllowed ? [1, 1.1, 1] : 1',
      '"0 0 20px rgba(239, 68, 68, 0.8)"',
      "transition={{ duration: 1.5, repeat: motionAllowed ? Infinity : 0, delay: 0.5 }}",
    ]) {
      expect(scheduleSource).toContain(currentFullMotionValue);
    }
  });

  it("keeps particles visible but removes their animation classes and timing when denied", () => {
    expect(particles).toContain("animated?: boolean");
    expect(particles).toContain("animated = true");
    expect(particles).toContain("animated && particle.id % 5 === 0");
    expect(particles).toContain("animationDelay: animated ?");
    expect(particles).toContain("animationDuration: animated ?");
    expect(particles).toContain("if (!active) return null");
  });
});
