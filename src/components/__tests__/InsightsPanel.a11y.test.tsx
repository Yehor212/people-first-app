import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Insight } from "@/types";

const insight: Insight = {
  id: "insight-1",
  type: "mood-tag",
  severity: "info",
  title: "Observed pattern",
  description: "Observed description",
  confidence: 50,
  dataPoints: 8,
  createdAt: 1,
  metadata: {
    type: "mood-tag",
    tag: "outside",
    avgMoodWith: 4,
    avgMoodWithout: 3,
    improvement: 33,
    occurrences: 4,
  },
};

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      insightsTitle: "Personal Insights",
      insightsHelpTitle: "About Insights",
      insightsExpand: "Expand insights",
      insightsCollapse: "Collapse insights",
    },
  }),
}));

vi.mock("@/hooks/useInsights", () => ({
  useInsights: () => ({
    insights: [insight],
    topInsight: insight,
    dismissInsight: vi.fn(),
    hasEnoughData: true,
    visibleCount: 1,
    totalGenerated: 1,
  }),
}));

vi.mock("@/components/InsightCard", () => ({
  InsightCard: () => <div>Insight card</div>,
}));

import { InsightsPanel } from "@/components/InsightsPanel";

describe("InsightsPanel accessibility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["header", false],
    ["collapsible content", true],
  ])("keeps the %s help control at the project 44px target", (_label, collapsible) => {
    render(
      <InsightsPanel
        moods={[]}
        habits={[]}
        focusSessions={[]}
        collapsible={collapsible}
      />,
    );

    expect(screen.getByRole("button", { name: "About Insights" })).toHaveClass(
      "min-h-[44px]",
      "min-w-[44px]",
    );
  });
});
