import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    getToday: () => "2026-04-26",
  };
});

import {
  buildJournalSuggestions,
  buildReflectionInsights,
  createDayRitualDraft,
  getRecommendedRitualType,
  mergeReflectionInsights,
  upsertDayRitual,
} from "@/lib/reflectionIntelligence";
import { makeTestHabit } from "@/test/habitFixtures";
import type {
  DayRitual,
  FocusSession,
  MoodEntry,
  ReflectionInsightCard,
} from "@/types";

const tx: Record<string, string> = {
  moodGreat: "Great",
  moodGood: "Good",
  moodOkay: "Okay",
  moodBad: "Bad",
  moodTerrible: "Terrible",
  minutes: "min",
  days: "days",
  entries: "entries",
};

function makeMood(overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: "m1",
    mood: "good",
    date: "2026-04-26",
    timestamp: Date.parse("2026-04-26T09:00:00Z"),
    valence: 0.5,
    ...overrides,
  };
}

function makeFocusSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: "f1",
    duration: 35,
    completedAt: Date.parse("2026-04-26T11:00:00Z"),
    date: "2026-04-26",
    status: "completed",
    ...overrides,
  };
}

function makeRitual(overrides: Partial<DayRitual> = {}): DayRitual {
  return {
    id: "opening-2026-04-26",
    type: "opening",
    date: "2026-04-26",
    timestamp: Date.parse("2026-04-26T08:00:00Z"),
    updatedAt: Date.parse("2026-04-26T08:00:00Z"),
    priorities: ["Protect the first focus block"],
    wins: [],
    drains: [],
    mood: "good",
    ...overrides,
  };
}

describe("reflectionIntelligence", () => {
  it("recommends an opening ritual before late afternoon", () => {
    const result = getRecommendedRitualType(undefined, undefined, new Date("2026-04-26T09:00:00"));
    expect(result).toBe("opening");
  });

  it("upserts rituals by stable daily id", () => {
    const initial = makeRitual();
    const next = makeRitual({ focusIntent: "Protect the first deep-work hour" });
    const merged = upsertDayRitual([initial], next);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.focusIntent).toBe("Protect the first deep-work hour");
  });

  it("builds ritual-led journal suggestions first", () => {
    const suggestions = buildJournalSuggestions({
      moods: [makeMood()],
      habits: [
        makeTestHabit({
          entries: {
            "2026-04-26": { value: 2 },
          },
        }),
      ],
      focusSessions: [makeFocusSession()],
      gratitudeEntries: [],
      rituals: [makeRitual()],
      tx,
      now: new Date("2026-04-26T20:00:00"),
    });

    expect(suggestions[0]?.source).toBe("ritual-opening");
    expect(suggestions.some((suggestion) => suggestion.source === "focus")).toBe(true);
  });

  it("preserves durable insight status when regenerated", () => {
    const existing: ReflectionInsightCard[] = [
      {
        id: "generated-habit-h1",
        source: "behavior-pattern",
        title: "Meditation improves your mood",
        summary: "Existing summary",
        experiment: "Existing experiment",
        confidence: 0.7,
        impact: "medium",
        evidence: [{ label: "Sample", detail: "3 days" }],
        status: "testing",
        createdAt: 1,
        updatedAt: 2,
      },
    ];

    const regenerated: ReflectionInsightCard[] = [
      {
        ...existing[0],
        summary: "Regenerated summary",
        confidence: 0.91,
        updatedAt: 999,
        status: "new",
      },
    ];

    const merged = mergeReflectionInsights(existing, regenerated);
    expect(merged[0]?.status).toBe("testing");
    expect(merged[0]?.summary).toBe("Regenerated summary");
  });

  it("creates ritual-sensitive insights when ritual days outperform others", () => {
    const rituals = [
      makeRitual(),
      makeRitual({ id: "opening-2026-04-24", date: "2026-04-24", timestamp: 1, updatedAt: 1 }),
      makeRitual({ id: "opening-2026-04-25", date: "2026-04-25", timestamp: 2, updatedAt: 2 }),
    ];
    const focusSessions = [
      makeFocusSession(),
      makeFocusSession({ id: "f2", date: "2026-04-24", completedAt: 2, duration: 42 }),
      makeFocusSession({ id: "f3", date: "2026-04-25", completedAt: 3, duration: 40 }),
      makeFocusSession({ id: "f4", date: "2026-04-22", completedAt: 4, duration: 18 }),
      makeFocusSession({ id: "f5", date: "2026-04-23", completedAt: 5, duration: 20 }),
    ];

    const insights = buildReflectionInsights({
      moods: [makeMood()],
      habits: [],
      focusSessions,
      gratitudeEntries: [],
      rituals,
      tx,
    });

    expect(insights.some((insight) => insight.id === "ritual-opening-focus-anchor")).toBe(true);
  });

  it("creates normalized day ritual drafts", () => {
    const ritual = createDayRitualDraft("opening", {
      priorities: [" Deep work ", "", "Walk", "Overflow"],
      wins: [],
      drains: [],
      note: "  Keep it gentle. ",
    });

    expect(ritual.priorities).toEqual(["Deep work", "Walk", "Overflow"]);
    expect(ritual.note).toBe("Keep it gentle.");
  });
});
