/**
 * HeroIdentityPrompt — daily-rotating identity statement.
 */
import { render, cleanup, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2HabitsIdentityToday: "Today you choose to be:",
      navV2HabitsIdentitySentence: "Today you choose to be {identity}",
      navV2HabitsIdentityIntention: "someone who keeps their word",
      navV2HabitsIdentityIntentions:
        "someone who keeps their word|someone who starts small|someone who returns to rhythm",
    },
    language: "en",
  }),
}));

import {
  HeroIdentityPrompt,
  parseDailyIdentityIntentions,
  pickDailyIdentityForDay,
  pickIdentityForDay,
} from "../HeroIdentityPrompt";
import type { Habit } from "@/types";

const habit = (overrides: Partial<Habit>): Habit => ({
  id: "h",
  name: "x",
  icon: "x",
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
  ...overrides,
});

describe("pickIdentityForDay", () => {
  it("returns null when no habit has identityVerb", () => {
    expect(pickIdentityForDay([habit({})], 1)).toBeNull();
  });
  it("rotates deterministically by day", () => {
    const a = habit({ id: "a", identityVerb: "a runner", identityIcon: "🏃" });
    const b = habit({ id: "b", identityVerb: "a writer", identityIcon: "✍️" });
    const day1 = pickIdentityForDay([a, b], 1);
    const day3 = pickIdentityForDay([a, b], 3);
    const day2 = pickIdentityForDay([a, b], 2);
    expect(day1).toEqual(day3); // 1 % 2 === 3 % 2
    expect(day1).not.toEqual(day2);
  });
  it("falls back to icon when identityIcon missing", () => {
    const a = habit({ identityVerb: "a runner", identityIcon: "", icon: "🏃" });
    expect(pickIdentityForDay([a], 1)?.icon).toBe("🏃");
  });
});

describe("daily default identity prompts", () => {
  it("parses the localized monthly phrase bank", () => {
    expect(parseDailyIdentityIntentions(" first | second || third ")).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("rotates fallback phrases by one-based calendar day", () => {
    const phrases = "someone who keeps their word|someone who starts small|someone who returns";
    expect(pickDailyIdentityForDay(phrases, 1)?.verb).toBe("someone who keeps their word");
    expect(pickDailyIdentityForDay(phrases, 2)?.verb).toBe("someone who starts small");
    expect(pickDailyIdentityForDay(phrases, 4)?.verb).toBe("someone who keeps their word");
  });
});

describe("HeroIdentityPrompt", () => {
  afterEach(() => cleanup());
  it("falls back to the daily identity phrase when no habit has identityVerb", () => {
    render(<HeroIdentityPrompt habits={[habit({})]} dayOfMonth={1} />);
    expect(screen.getByTestId("hero-identity-verb")).toHaveTextContent(
      "someone who keeps their word",
    );
    expect(screen.getByTestId("hero-identity-prompt")).toHaveTextContent(
      "Today you choose to be",
    );
  });
  it("changes the generic identity phrase across calendar days", () => {
    render(<HeroIdentityPrompt habits={[habit({})]} dayOfMonth={2} />);
    expect(screen.getByTestId("hero-identity-verb")).toHaveTextContent(
      "someone who starts small",
    );
  });
  it("shows the picked identity when configured", () => {
    const h = habit({ identityVerb: "a writer", identityIcon: "✍️" });
    render(<HeroIdentityPrompt habits={[h]} dayOfMonth={5} />);
    expect(screen.getByTestId("hero-identity-verb")).toHaveTextContent("a writer");
  });
});
