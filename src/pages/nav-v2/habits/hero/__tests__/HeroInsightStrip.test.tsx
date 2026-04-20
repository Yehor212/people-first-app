/**
 * HeroInsightStrip — V1 insightsEngine → V2 UI wiring tests.
 */
import { render, cleanup, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      insightMorning: "mornings-win",
      insightAfternoon: "afternoons-win",
      insightEvening: "evenings-win",
      insightHabitImprovesMood: "{habit} lifts mood",
      insightHabitImprovesMoodDesc: 'Doing "{habit}" improves mood by {percent}%',
      insightFocusBestLabel: 'Best focus: "{label}"',
      insightFocusBestLabelDesc: 'Focus {minutes} min on "{label}"',
      insightPeakFocusTime: "Peak focus at {timeOfDay}",
      insightPeakFocusTimeDesc: "Best focus around {time}",
      insightBestTimeForHabit: "Best time for {habit}: {time}",
      insightBestTimeForHabitDesc: '"{habit}" is best {time} at {percent}%',
      insightTagBoostsMood: 'Tag "{tag}" helps',
      insightTagBoostsMoodDesc: '"{tag}" improves mood by {percent}%',
    },
    language: "en",
  }),
}));

let mockInsights: Array<{ id: string; title: string; description: string; severity: string; confidence: number; type: string }> = [];
let capturedTranslations: Record<string, string> | null = null;
vi.mock("@/lib/insightsEngine", () => ({
  generateInsights: (
    _moods: unknown[],
    _habits: unknown[],
    _focusSessions: unknown[],
    translations: Record<string, string>,
  ) => {
    capturedTranslations = translations;
    return mockInsights;
  },
}));

vi.mock("@/stores", () => ({
  useUserDataStore: (selector: (s: unknown) => unknown) =>
    selector({ moods: [], habits: [], focusSessions: [] }),
}));

import { HeroInsightStrip } from "../HeroInsightStrip";

describe("HeroInsightStrip", () => {
  beforeEach(() => {
    mockInsights = [];
    capturedTranslations = null;
  });
  afterEach(() => cleanup());

  it("renders nothing when there are no insights", () => {
    render(<HeroInsightStrip />);
    expect(screen.queryByTestId("habits-hero-insight-strip")).not.toBeInTheDocument();
  });

  it("passes the existing V1 translation contract into insightsEngine", () => {
    render(<HeroInsightStrip />);
    expect(capturedTranslations).toEqual({
      morning: "mornings-win",
      afternoon: "afternoons-win",
      evening: "evenings-win",
      habitImprovesMood: "{habit} lifts mood",
      habitImprovesMoodDesc: 'Doing "{habit}" improves mood by {percent}%',
      focusBestLabel: 'Best focus: "{label}"',
      focusBestLabelDesc: 'Focus {minutes} min on "{label}"',
      peakFocusTime: "Peak focus at {timeOfDay}",
      peakFocusTimeDesc: "Best focus around {time}",
      bestTimeForHabit: "Best time for {habit}: {time}",
      bestTimeForHabitDesc: '"{habit}" is best {time} at {percent}%',
      tagBoostsMood: 'Tag "{tag}" helps',
      tagBoostsMoodDesc: '"{tag}" improves mood by {percent}%',
    });
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
