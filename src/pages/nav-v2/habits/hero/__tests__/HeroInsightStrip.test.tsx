/**
 * HeroInsightStrip — V1 insightsEngine → V2 UI wiring tests.
 */
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { Habit } from "@/types";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      insightsTitle: "Personal Insights",
      statistics: "Statistics",
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
let mockHabits: Habit[] = [];
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
    selector({ moods: [], habits: mockHabits, focusSessions: [] }),
}));

import { HeroInsightStrip } from "../HeroInsightStrip";

describe("HeroInsightStrip", () => {
  beforeEach(() => {
    mockInsights = [];
    capturedTranslations = null;
    mockHabits = [];
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

  it("renders a statistics CTA for habit-linked insights and opens the linked habit", () => {
    mockHabits = [
      {
        id: "habit-1",
        name: "Meditate",
        icon: "🧘",
        color: 0,
        position: 0,
        createdAt: 0,
        habitType: "boolean",
        frequency: { numerator: 1, denominator: 1 },
        question: "",
        description: "",
        isArchived: false,
        targetValue: 1,
        targetType: "atLeast",
        unit: "",
        entries: {},
        reminders: [],
      },
    ];
    mockInsights = [
      {
        id: "i1",
        title: "Meditation is carrying your week",
        description: "On days you meditate, mood +28%",
        severity: "celebration",
        confidence: 87,
        type: "mood-habit-correlation",
        metadata: {
          type: "mood-habit-correlation",
          habitId: "habit-1",
          habitName: "Meditate",
        },
      } as never,
    ];
    const onOpenHabitInsight = vi.fn();
    render(<HeroInsightStrip onOpenHabitInsight={onOpenHabitInsight} />);
    fireEvent.click(screen.getByTestId("habits-hero-insight-cta"));
    expect(onOpenHabitInsight).toHaveBeenCalledTimes(1);
    expect(onOpenHabitInsight).toHaveBeenCalledWith(
      expect.objectContaining({ id: "habit-1", name: "Meditate" }),
    );
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
