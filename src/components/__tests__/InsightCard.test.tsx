import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Insight } from "@/types";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    isRTL: false,
    t: {
      insightDataPoints: "recorded entries",
      insightSessions: "sessions",
      days: "recorded days",
      times: "completions",
    },
  }),
}));

import { InsightCard } from "@/components/InsightCard";

function createMoodTagInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "mood-tag-outside",
    type: "mood-tag",
    severity: "tip",
    title: '"outside" appears with higher recorded mood',
    description:
      "Across 5 recorded entries, the entries show an association, not proof of causation.",
    confidence: 76,
    dataPoints: 8,
    createdAt: 1,
    metadata: {
      type: "mood-tag",
      tag: "outside",
      avgMoodWith: 5,
      avgMoodWithout: 3,
      improvement: 67,
      occurrences: 5,
    },
    ...overrides,
  };
}

describe("InsightCard", () => {
  it("does not present the internal ranking score as statistical confidence", () => {
    const insight = createMoodTagInsight();

    const { container } = render(<InsightCard insight={insight} />);

    expect(screen.getByText(insight.title)).toBeInTheDocument();
    expect(screen.getByText("8 recorded entries")).toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent("76%");
    expect(container.querySelector('[style*="width: 76%"]')).toBeNull();
  });

  it("exposes disclosure state and the controlled details region", () => {
    render(<InsightCard insight={createMoodTagInsight()} />);

    const trigger = screen.getByRole("button", {
      name: /outside.*higher recorded mood/i,
    });
    const detailsId = trigger.getAttribute("aria-controls");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(detailsId).toBeTruthy();
    expect(document.getElementById(detailsId!)).toBeNull();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(detailsId!)).toHaveAttribute("role", "region");
  });

  it.each([
    [
      "mood-habit-correlation",
      {
        type: "mood-habit-correlation",
        habitId: "habit-1",
        habitName: "Walk",
        moodImprovement: 12,
        avgMoodWith: 4,
        avgMoodWithout: 3.5,
        sampleDays: 5,
      },
      "8 recorded days",
    ],
    [
      "focus-pattern",
      {
        type: "focus-pattern",
        bestLabel: "Writing",
        avgDuration: 25,
        successRate: 100,
        totalSessions: 8,
      },
      "8 sessions",
    ],
    [
      "habit-timing",
      {
        type: "habit-timing",
        habitId: "habit-1",
        habitName: "Walk",
        bestTime: "morning",
        morningCount: 5,
        afternoonCount: 2,
        eveningCount: 1,
        bestTimePercent: 63,
      },
      "8 completions",
    ],
  ] as const)("labels %s observations with their actual unit", (type, metadata, expected) => {
    render(
      <InsightCard
        insight={createMoodTagInsight({
          id: `${type}-insight`,
          type,
          metadata,
        } as Partial<Insight>)}
      />,
    );

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("allows long user-derived labels and descriptions to reflow", () => {
    const longValue = `https://example.test/${"segment".repeat(30)}`;
    render(
      <InsightCard
        insight={createMoodTagInsight({
          title: longValue,
          description: longValue,
        })}
      />,
    );

    expect(screen.getByText(longValue, { selector: "h3" })).toHaveClass(
      "break-words",
      "[overflow-wrap:anywhere]",
    );
    expect(screen.getByText(longValue, { selector: "p" })).toHaveClass(
      "break-words",
      "[overflow-wrap:anywhere]",
    );
  });
});
