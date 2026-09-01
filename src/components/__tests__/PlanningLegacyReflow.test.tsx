import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScheduleClock } from "../schedule/ScheduleVisuals";

describe("Planning legacy surface reflow", () => {
  it("keeps the live time inside its clock ring at enlarged text sizes", () => {
    render(<ScheduleClock currentHour={9} currentMinute={46} language="en" />);

    const ring = screen.getByTestId("schedule-clock-ring");
    const time = screen.getByTestId("schedule-clock-time");

    expect(ring).toHaveClass("h-16", "w-16", "shrink-0");
    expect(time).toHaveClass(
      "min-w-0",
      "max-w-full",
      "whitespace-nowrap",
      "text-center",
      "text-xs",
    );
    expect(time).not.toHaveClass("min-[420px]:text-base");
    expect(time).not.toHaveClass("text-xl");
  });

  it("keeps schedule icon actions at least 44 pixels in both dimensions", () => {
    const source = readFileSync("src/components/schedule/ScheduleTimeline.tsx", "utf8");
    const boundedIconActions = source.match(/min-h-11 min-w-11/g) ?? [];

    expect(boundedIconActions).toHaveLength(2);
  });

  it("stacks the schedule header before its clock, title, and actions can widen the card", () => {
    const source = readFileSync("src/components/schedule/ScheduleTimeline.tsx", "utf8");

    expect(source).toContain(
      'className="relative w-full min-w-0 max-w-full overflow-hidden rounded-3xl border border-border/50 bg-card text-card-foreground"',
    );
    expect(source).toContain('className="min-w-0 p-4"');
    expect(source).toContain(
      'className="mb-4 flex min-w-0 flex-col items-stretch gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"',
    );
    expect(source).toContain('className="flex min-w-0 items-center gap-3"');
    expect(source).toContain('className="min-w-0 flex-1"');
    expect(source).toContain("min-w-0 flex-wrap");
    expect(source).toContain('className="flex flex-wrap items-center justify-end gap-2 self-end"');
  });

  it("stacks the focus summary before translated copy can collide", () => {
    const source = readFileSync("src/components/focus-timer/FocusTimer.tsx", "utf8");

    expect(source).toContain(
      "mb-6 relative flex min-w-0 flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between",
    );
    expect(source).toContain(
      "flex min-w-0 max-w-full flex-wrap items-center gap-2 whitespace-normal",
    );
    expect(source).toContain("[overflow-wrap:normal]");
  });

  it("associates the localized focus prompt with its editable label field", () => {
    const source = readFileSync("src/components/focus-timer/FocusTimer.tsx", "utf8");

    expect(source).toContain('htmlFor="focus-session-label"');
    expect(source).toContain('id="focus-session-label"');
    expect(source).toContain('name="focus-session-label"');
    expect(source).toContain('aria-label={t.focusLabelPrompt}');
  });
});
