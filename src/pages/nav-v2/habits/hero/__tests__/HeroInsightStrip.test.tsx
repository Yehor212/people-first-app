/**
 * HeroInsightStrip — V1 insightsEngine → V2 UI wiring tests.
 */
import { act, render, cleanup, screen, fireEvent } from "@testing-library/react";
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
      insightHabitImprovesMood: "{habit} appears with higher recorded mood",
      insightHabitImprovesMoodDesc:
        'Across {sampleDays} recorded days with "{habit}", mood was {avgMoodWith}/5 versus {avgMoodWithout}/5 across {comparisonDays} other recorded days; this is an association, not proof of causation.',
      insightFocusBestLabel: 'Best focus: "{label}"',
      insightFocusBestLabelDesc: 'Focus {minutes} min on "{label}"',
      insightPeakFocusTime: "Peak focus at {timeOfDay}",
      insightPeakFocusTimeDesc: "Best focus around {time}",
      insightBestTimeForHabit: "Best time for {habit}: {time}",
      insightBestTimeForHabitDesc: '"{habit}" is best {time} at {percent}%',
      insightTagBoostsMood: 'Tag "{tag}" appears with higher recorded mood',
      insightTagBoostsMoodDesc:
        'Across {occurrences} tagged entries, mood was {avgMoodWith}/5 versus {avgMoodWithout}/5 across {untaggedEntries} untagged entries; this is an association, not proof of causation.',
    },
    language: "en",
  }),
}));

let mockInsights: Array<{ id: string; title: string; description: string; severity: string; confidence: number; type: string }> = [];
let capturedTranslations: Record<string, string> | null = null;
const mockMoods: unknown[] = [];
const mockFocusSessions: unknown[] = [];
let mockHabits: Habit[] = [];
const scheduleIdleCallbacks: Array<() => void> = [];
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

vi.mock("@/lib/scheduleIdle", () => ({
  scheduleIdle: vi.fn((callback: () => void) => {
    scheduleIdleCallbacks.push(callback);
    return {
      cancel: vi.fn(() => {
        const index = scheduleIdleCallbacks.indexOf(callback);
        if (index >= 0) scheduleIdleCallbacks.splice(index, 1);
      }),
    };
  }),
}));

vi.mock("@/stores", () => ({
  useUserDataStore: (selector: (s: unknown) => unknown) =>
    selector({ moods: mockMoods, habits: mockHabits, focusSessions: mockFocusSessions }),
}));

import { HeroInsightStrip } from "../HeroInsightStrip";

async function runNextIdleCallback() {
  await act(async () => {
    scheduleIdleCallbacks.shift()?.();
  });
}

describe("HeroInsightStrip", () => {
  beforeEach(() => {
    mockInsights = [];
    capturedTranslations = null;
    mockHabits = [];
    scheduleIdleCallbacks.length = 0;
  });
  afterEach(() => cleanup());

  it("renders nothing when there are no insights", () => {
    render(<HeroInsightStrip />);
    expect(screen.queryByTestId("habits-hero-insight-strip")).not.toBeInTheDocument();
  });

  it("passes the existing V1 translation contract into insightsEngine", async () => {
    render(<HeroInsightStrip />);
    await runNextIdleCallback();
    expect(capturedTranslations).toEqual({
      morning: "mornings-win",
      afternoon: "afternoons-win",
      evening: "evenings-win",
      habitImprovesMood: "{habit} appears with higher recorded mood",
      habitImprovesMoodDesc:
        'Across {sampleDays} recorded days with "{habit}", mood was {avgMoodWith}/5 versus {avgMoodWithout}/5 across {comparisonDays} other recorded days; this is an association, not proof of causation.',
      focusBestLabel: 'Best focus: "{label}"',
      focusBestLabelDesc: 'Focus {minutes} min on "{label}"',
      peakFocusTime: "Peak focus at {timeOfDay}",
      peakFocusTimeDesc: "Best focus around {time}",
      bestTimeForHabit: "Best time for {habit}: {time}",
      bestTimeForHabitDesc: '"{habit}" is best {time} at {percent}%',
      tagBoostsMood: 'Tag "{tag}" appears with higher recorded mood',
      tagBoostsMoodDesc:
        'Across {occurrences} tagged entries, mood was {avgMoodWith}/5 versus {avgMoodWithout}/5 across {untaggedEntries} untagged entries; this is an association, not proof of causation.',
    });
  });

  it("renders the top insight without exposing the internal ranking score", async () => {
    mockInsights = [
      {
        id: "i1",
        title: "On days you meditate, mood +28%",
        description: "Across 42 recorded days, the entries show an association.",
        severity: "celebration",
        confidence: 87,
        type: "mood-habit",
      },
    ];
    render(<HeroInsightStrip />);
    await runNextIdleCallback();
    const strip = screen.getByTestId("habits-hero-insight-strip");
    expect(strip).toHaveAttribute("data-severity", "celebration");
    expect(screen.getByTestId("habits-hero-insight-title")).toHaveTextContent(
      "On days you meditate, mood +28%",
    );
    expect(strip).toHaveTextContent("42 recorded days");
    expect(strip).not.toHaveTextContent("87%");
    expect(screen.queryByLabelText(/confidence/i)).not.toBeInTheDocument();
  });

  it("renders a statistics CTA for habit-linked insights and opens the linked habit", async () => {
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
    await runNextIdleCallback();
    fireEvent.click(screen.getByTestId("habits-hero-insight-cta"));
    expect(onOpenHabitInsight).toHaveBeenCalledTimes(1);
    expect(onOpenHabitInsight).toHaveBeenCalledWith(
      expect.objectContaining({ id: "habit-1", name: "Meditate" }),
    );
  });

  it("applies warning styling for warning severity", async () => {
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
    await runNextIdleCallback();
    const strip = screen.getByTestId("habits-hero-insight-strip");
    expect(strip).toHaveAttribute("data-severity", "warning");
    expect(strip.className).toContain("--zf-warning");
  });

  it("defers V1 insight generation until idle so Habits first paint is not blocked", async () => {
    mockInsights = [
      {
        id: "i1",
        title: "Later insight",
        description: "Computed after first paint",
        severity: "tip",
        confidence: 70,
        type: "habit-timing",
      },
    ];

    render(<HeroInsightStrip />);

    expect(capturedTranslations).toBeNull();
    expect(screen.queryByTestId("habits-hero-insight-strip")).not.toBeInTheDocument();

    await runNextIdleCallback();

    expect(capturedTranslations).not.toBeNull();
    expect(screen.getByTestId("habits-hero-insight-strip")).toHaveTextContent("Later insight");
  });

});
