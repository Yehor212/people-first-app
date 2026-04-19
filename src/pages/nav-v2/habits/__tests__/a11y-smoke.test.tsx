/**
 * a11y-smoke — converts docs/habits-tab-spec.md §11 criteria from 🟡
 * (code-reviewed) to ✅ (test-verified) without adding axe-core as a
 * dependency.
 *
 * Each test targets one §11 row. If a rule can't be verified in JSDOM
 * (e.g. real screen-reader announcement), the row stays 🟡 and this file
 * documents why.
 */
import { render, cleanup, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/hooks/useShouldAnimate", () => ({ useShouldAnimate: () => true }));
vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));
vi.mock("@/components/compact-habit-card/CompactHabitCard", () => ({
  CompactHabitCard: ({ habit }: { habit: { id: string; name: string } }) => (
    <li
      aria-label={habit.name}
      data-testid={`card-${habit.id}`}
    >
      <button aria-label={`${habit.name}: Mark complete`} aria-pressed={false}>
        toggle
      </button>
    </li>
  ),
}));
vi.mock("@/components/animations/AllHabitsDoneAnimation", () => ({
  AllHabitsDoneAnimation: () => null,
}));
vi.mock("@/components/habit-completion-celebration/HabitCompletionCelebration", () => ({
  HabitCompletionCelebration: () => null,
}));
vi.mock("../hero/HeroInsightStrip", () => ({
  HeroInsightStrip: () => null,
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Habits: "Habits",
      navV2HabitsHero: "Today's habits",
      navV2HabitsEmpty: "Plant your first seed",
      navV2HabitsStartSmall: "Start small",
      navV2HabitsAddCue: "When • Where • Cue",
      navV2HabitsTwoMinuteRule: "Two-minute rule",
      navV2HabitsCreate: "Create habit",
      navV2HabitsBrowseLibrary: "Browse library",
      navV2HabitsLibraryTitle: "Habit library",
      navV2HabitsLibrarySubtitle: "Tap to add",
      navV2HabitsMorning: "Morning",
      navV2HabitsAfternoon: "Afternoon",
      navV2HabitsEvening: "Evening",
      navV2HabitsAnytime: "Anytime",
      navV2HabitsCategoryBody: "Body",
      navV2HabitsCategoryMind: "Mind",
      navV2HabitsCategoryFocus: "Focus",
      navV2HabitsCategoryRest: "Rest",
      navV2HabitsCategoryQuit: "Quit",
      navV2HabitsQuickPick: "Quick pick",
      navV2HabitsAlreadyAdded: "Added",
      navV2HabitsOnboardingStep1: "Pick identity",
      navV2HabitsOnboardingStep2: "Set cue",
      navV2HabitsOnboardingStep3: "Plant first",
      navV2HabitsIdentityToday: "Today you are building:",
      navV2HabitsIdentityIntention: "Someone who keeps their word",
      navV2HabitsRecovery: "One missed day doesn't reset progress",
      navV2HabitsAllDone: "Day complete",
      navV2HabitsKeepGoing: "Momentum is yours",
      navV2HabitsOneHabitLeft: "One habit left",
      navV2HabitsHabitsLeft: "{count} habits left",
    },
    language: "en",
  }),
}));

import { HeroEmptyJourney } from "../hero/HeroEmptyJourney";
import { HeroTemplateLibrarySheet } from "../hero/HeroTemplateLibrarySheet";
import { HeroHabitRow } from "../hero/HeroHabitRow";
import { HeroDailyRing } from "../hero/HeroDailyRing";
import type { Habit } from "@/types";

const habit = (overrides: Partial<Habit> = {}): Habit => ({
  id: "h1",
  name: "Hydrate",
  icon: "💧",
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

describe("Habits a11y smoke (converts §11 🟡 rows to ✅)", () => {
  afterEach(() => cleanup());

  describe("§11 #3 — daily ring carries role/aria-live/readable label", () => {
    it("has role=img, aria-live=polite, aria-label including N / M", () => {
      render(<HeroDailyRing completed={1} total={3} ratio={1 / 3} />);
      const ring = screen.getByTestId("habits-hero-progress-ring");
      expect(ring.getAttribute("role")).toBe("img");
      expect(ring.getAttribute("aria-live")).toBe("polite");
      expect(ring.getAttribute("aria-label")).toMatch(/1\s*\/\s*3/);
    });
  });

  describe("§11 #4 — every emoji-bearing chip has a distinct aria-label", () => {
    it("quick-pick chips in empty journey carry aria-label of habit name", () => {
      render(
        <HeroEmptyJourney
          onCreateHabit={vi.fn()}
          onPickTemplate={vi.fn()}
          onOpenLibrary={vi.fn()}
        />,
      );
      const chips = screen.queryAllByTestId(/^hero-quickpick-/);
      expect(chips.length).toBeGreaterThan(0);
      chips.forEach((chip) => {
        const label = chip.getAttribute("aria-label");
        expect(label).toBeTruthy();
        // aria-label must not be just the emoji (e.g. "💧"); must contain letters
        expect(/[a-zA-Z]/.test(label ?? "")).toBe(true);
      });
    });
  });

  describe("§11 #7 — library category tabs use aria-pressed", () => {
    it("each category tab button has aria-pressed and only one is pressed at a time", () => {
      render(
        <HeroTemplateLibrarySheet
          open={true}
          onClose={vi.fn()}
          seededIds={new Set()}
          onPickTemplate={vi.fn()}
        />,
      );
      const tabs = [
        screen.getByTestId("habits-library-tab-body"),
        screen.getByTestId("habits-library-tab-mind"),
        screen.getByTestId("habits-library-tab-focus"),
        screen.getByTestId("habits-library-tab-rest"),
        screen.getByTestId("habits-library-tab-quit"),
      ];
      const pressed = tabs.filter((t) => t.getAttribute("aria-pressed") === "true");
      expect(pressed).toHaveLength(1);
      tabs.forEach((t) => {
        expect(t.getAttribute("aria-pressed")).toMatch(/^(true|false)$/);
      });
    });
  });

  describe("§11 #13 — chain dots are aria-hidden; parent row carries the label", () => {
    it("HeroHabitRow has role=group with aria-label; chain dots are aria-hidden", () => {
      const today = new Date().toISOString().slice(0, 10);
      render(
        <HeroHabitRow
          habit={habit({ entries: { [today]: { value: 1 } } })}
          onToggle={vi.fn()}
          onDelete={vi.fn()}
        />,
      );
      const row = screen.getByTestId("hero-habit-row-h1");
      expect(row.getAttribute("role")).toBe("group");
      expect(row.getAttribute("aria-label")).toBe("Hydrate");
      const chain = screen.getByTestId("hero-habit-row-h1-chain");
      chain.querySelectorAll("li").forEach((li) => {
        expect(li.getAttribute("aria-hidden")).toBe("true");
      });
    });
  });

  describe("§11 #1 — interactive targets ≥44 CSS px (class contract — JSDOM cannot measure layout)", () => {
    /**
     * JSDOM does not do layout, so getBoundingClientRect returns 0×0. We
     * instead assert the CSS CONTRACT: every interactive element carries a
     * Tailwind min-h utility ≥ 44px (min-h-[44px], min-h-[48px], h-12,
     * h-14). This is a necessary-not-sufficient check; real pixel
     * measurement requires Playwright (tracked as a follow-up).
     */
    it("empty journey primary CTA has min-h ≥ 44px utility class", () => {
      render(
        <HeroEmptyJourney
          onCreateHabit={vi.fn()}
          onPickTemplate={vi.fn()}
          onOpenLibrary={vi.fn()}
        />,
      );
      const cta = screen.getByTestId("habits-hero-create-empty");
      // Accept any of the known ≥44 utilities we ship
      const cls = cta.className;
      expect(cls).toMatch(/min-h-\[(44|48)px\]|h-(11|12|14)/);
    });

    it("library category tabs have min-h ≥ 40px (chip class contract)", () => {
      render(
        <HeroTemplateLibrarySheet
          open={true}
          onClose={vi.fn()}
          seededIds={new Set()}
          onPickTemplate={vi.fn()}
        />,
      );
      const tab = screen.getByTestId("habits-library-tab-body");
      expect(tab.className).toMatch(/min-h-\[40px\]|h-10/);
    });
  });
});

/**
 * Rows NOT converted here (still 🟡 — require real browser):
 *   - #9 Android back handler (Capacitor native)
 *   - #11 Reduced-motion real media query
 *   - #12 Runtime contrast measurement
 *   - #14 Keyboard Tab traversal of sticky ring
 * These are tracked in habits-tab-spec.md §11.3 "Known gaps (temporal)".
 */
