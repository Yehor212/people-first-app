/**
 * HeroInsightStrip — V1 insightsEngine → V2 UI wiring tests.
 */
import { render, cleanup, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: {}, language: "en" }),
}));

let mockInsights: Array<{ id: string; title: string; description: string; severity: string; confidence: number; type: string }> = [];
vi.mock("@/lib/insightsEngine", () => ({
  generateInsights: () => mockInsights,
}));

vi.mock("@/stores", () => ({
  useUserDataStore: (selector: (s: unknown) => unknown) =>
    selector({ moods: [], habits: [], focusSessions: [] }),
}));

import { HeroInsightStrip } from "../HeroInsightStrip";

describe("HeroInsightStrip", () => {
  beforeEach(() => {
    mockInsights = [];
  });
  afterEach(() => cleanup());

  it("renders nothing when there are no insights", () => {
    render(<HeroInsightStrip />);
    expect(screen.queryByTestId("habits-hero-insight-strip")).not.toBeInTheDocument();
  });

  it("renders the top insight with title + confidence", () => {
    mockInsights = [
      {
        id: "i1",
        title: "On days you meditate, mood +28%",
        description: "Based on 42 days of data",
        severity: "celebration",
        confidence: 87,
        type: "mood-habit",
      },
    ];
    render(<HeroInsightStrip />);
    const strip = screen.getByTestId("habits-hero-insight-strip");
    expect(strip).toHaveAttribute("data-severity", "celebration");
    expect(screen.getByTestId("habits-hero-insight-title")).toHaveTextContent(
      "On days you meditate, mood +28%",
    );
    expect(strip).toHaveTextContent("87%");
  });

  it("applies warning styling for warning severity", () => {
    mockInsights = [
      {
        id: "i2",
        title: "Your streak is slipping",
        description: "3 skipped this week",
        severity: "warning",
        confidence: 72,
        type: "habit-timing",
      },
    ];
    render(<HeroInsightStrip />);
    const strip = screen.getByTestId("habits-hero-insight-strip");
    expect(strip).toHaveAttribute("data-severity", "warning");
    expect(strip.className).toContain("amber");
  });

});
