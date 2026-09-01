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

describe("HeroIdentityPrompt", () => {
  afterEach(() => cleanup());
  it("does not author an identity statement when the user has not configured one", () => {
    render(<HeroIdentityPrompt habits={[habit({})]} dayOfMonth={1} />);

    expect(screen.queryByTestId("hero-identity-prompt")).not.toBeInTheDocument();
    expect(screen.queryByText("someone who keeps their word")).not.toBeInTheDocument();
  });

  it("shows the picked identity when configured", () => {
    const h = habit({ identityVerb: "a writer", identityIcon: "✍️" });
    render(<HeroIdentityPrompt habits={[h]} dayOfMonth={5} />);
    expect(screen.getByTestId("hero-identity-verb")).toHaveTextContent("a writer");
  });
});
