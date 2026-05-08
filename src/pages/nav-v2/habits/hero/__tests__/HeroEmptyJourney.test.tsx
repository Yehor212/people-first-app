/**
 * HeroEmptyJourney - V2 starter empty state.
 */
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/hooks/useShouldAnimate", () => ({ useShouldAnimate: () => true }));
vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2HabitsEmpty: "Plant your first seed",
      navV2HabitsStartSmall: "Start with real habits",
      navV2HabitsAddCue: "When Where Cue",
      navV2HabitsTwoMinuteRule: "2-minute rule",
      navV2HabitsCreate: "Create habit",
      navV2HabitsOnboardingStep1: "Pick your identity",
      navV2HabitsOnboardingStep2: "Set your cue",
      navV2HabitsOnboardingStep3: "Plant your first habit",
      navV2HabitsQuickPick: "Quick pick",
      navV2HabitsBrowseLibrary: "Library",
    },
    language: "en",
  }),
}));

import { HeroEmptyJourney } from "../HeroEmptyJourney";
import { habitTemplates, ROUTINE_STARTER_TEMPLATE_IDS } from "@/lib/habitTemplates";

describe("HeroEmptyJourney", () => {
  afterEach(() => cleanup());

  it("renders the starter surface without method chips", () => {
    render(<HeroEmptyJourney onCreateHabit={vi.fn()} />);
    expect(screen.getByTestId("habits-hero-empty")).toHaveAttribute(
      "data-visual-role",
      "body",
    );
    expect(screen.queryByTestId("hero-empty-journey-steps")).not.toBeInTheDocument();
    expect(screen.queryByText(/Pick your identity/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Set your cue/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Plant your first habit/)).not.toBeInTheDocument();
  });

  it("invokes onCreateHabit when CTA is tapped", () => {
    const spy = vi.fn();
    render(<HeroEmptyJourney onCreateHabit={spy} />);
    fireEvent.click(screen.getByTestId("habits-hero-create-empty"));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does not render vague habit-method copy", () => {
    render(<HeroEmptyJourney onCreateHabit={vi.fn()} />);
    expect(screen.queryByText("2-minute rule")).not.toBeInTheDocument();
    expect(screen.queryByText("When Where Cue")).not.toBeInTheDocument();
  }, 15000);

  it("renders quick-pick chips as premium ritual deck cards", () => {
    render(
      <HeroEmptyJourney
        onCreateHabit={vi.fn()}
        onPickTemplate={vi.fn()}
        onOpenLibrary={vi.fn()}
      />,
    );

    const quickPicks = screen.getByTestId("hero-empty-quickpick");
    const roles = new Set(
      Array.from(quickPicks.querySelectorAll("[data-visual-role]")).map((node) =>
        node.getAttribute("data-visual-role"),
      ),
    );
    expect(roles.size).toBeGreaterThanOrEqual(5);
    expect(screen.getByTestId("hero-quickpick-drink-water")).toHaveAttribute(
      "data-visual-role",
      "focus",
    );
    expect(screen.getByTestId("hero-quickpick-walk-distance")).toHaveAttribute(
      "data-visual-role",
      "body",
    );
    expect(screen.getByTestId("hero-quickpick-exercise")).toHaveAttribute(
      "data-visual-role",
      "energy",
    );
    expect(screen.getByTestId("hero-quickpick-read")).toHaveAttribute(
      "data-visual-role",
      "focus",
    );
    expect(screen.getByTestId("hero-quickpick-meditate")).toHaveAttribute(
      "data-visual-role",
      "mind",
    );
    expect(screen.getByTestId("hero-quickpick-sleep")).toHaveAttribute(
      "data-visual-role",
      "rest",
    );
    expect(screen.getByTestId("hero-empty-open-library")).toHaveAttribute(
      "data-visual-role",
      "focus",
    );

    for (const chip of quickPicks.querySelectorAll("button")) {
      expect(chip).toHaveAttribute("data-tile", "ritual-deck-card");
      expect(chip.className).toContain("linear-gradient");
      expect(chip.className).toContain("min-h-[108px]");
      expect(chip.className).toContain("backdrop-blur-xl");
      expect(chip.className).not.toContain("--zf-night");
      const medallion = chip.querySelector("[data-icon-medallion='true']");
      expect(medallion).toBeTruthy();
      expect(medallion?.className).toContain("h-12");
      expect(medallion?.className).toContain("w-12");
      expect(medallion?.className).toContain("linear-gradient");
      const symbol = medallion?.querySelector("[data-slot='quickpick-symbol']");
      expect(symbol?.textContent?.trim()).toBeTruthy();
      const meta = chip.querySelector("[data-slot='quickpick-meta']");
      expect(meta).toBeTruthy();
      expect(meta?.className).toContain("text-[hsl(var(--foreground))]");
      expect(meta?.className).toContain("bg-[hsl(var(--card)/0.86)]");
      expect(meta?.className).toContain("tabular-nums");
      const label = chip.querySelector("[data-slot='quickpick-label']");
      expect(label).toBeTruthy();
      expect(label?.className).toContain("font-bold");
      expect(label?.className).toContain("max-w-full");
    }
  });

  it("uses broad starter habits instead of journal prompts or method fragments", () => {
    render(
      <HeroEmptyJourney
        onCreateHabit={vi.fn()}
        onPickTemplate={vi.fn()}
        onOpenLibrary={vi.fn()}
      />,
    );

    for (const templateId of ROUTINE_STARTER_TEMPLATE_IDS) {
      expect(screen.getByTestId(`hero-quickpick-${templateId}`)).toBeInTheDocument();
    }

    expect(screen.queryByTestId("hero-quickpick-gratitude")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-quickpick-breath-pause")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-quickpick-read-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-quickpick-stretch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-quickpick-water")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-quickpick-walk-run")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-quickpick-breathwork")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-quickpick-phone-free-morning")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-quickpick-phone-break")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-quickpick-movement-break")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-quickpick-delayed-caffeine")).not.toBeInTheDocument();
  });

  it("uses an ink-paper ritual deck with an aligned animated carousel", () => {
    render(<HeroEmptyJourney onCreateHabit={vi.fn()} />);

    const hero = screen.getByTestId("habits-hero-empty");
    const scene = screen.getByTestId("hero-ritual-board-scene");
    expect(hero).toHaveAttribute("data-tone", "ritual-deck");
    expect(hero).toHaveAttribute("data-surface", "ink-paper");
    expect(scene).toHaveAttribute(
      "data-scene",
      "ritual-carousel",
    );
    expect(scene.querySelector("[data-motion='ritual-card-carousel']")).toBeTruthy();
    expect(scene.querySelector("[data-ritual-comet='true']")).toBeTruthy();
    expect(scene.querySelector("[data-card-motion='ritual-card-focus']")).toBeTruthy();
    expect(scene.querySelector("[data-card-motion='ritual-card-body']")).toBeTruthy();
    expect(scene.querySelector("[data-card-motion='ritual-card-rest']")).toBeTruthy();
    expect(hero.className).not.toContain("--zf-surface-1");
    expect(hero.className).not.toContain("--zf-night");
    expect(hero.className).not.toContain("before:opacity-90");
    expect(hero.className).not.toContain("after:bg-[linear-gradient");
    expect(hero.className).not.toContain("hsl(var(--zf-role-focus)/0.30),transparent_36%");
    expect(hero.className).toContain("--zf-role-gratitude");
    expect(hero.className).toContain("--zf-role-energy");
    expect(hero.className).toContain("--zf-role-rest");
  });

  it("keeps first-screen starters broad and trackable", () => {
    const starters = ROUTINE_STARTER_TEMPLATE_IDS.map((templateId) =>
      habitTemplates.find((template) => template.id === templateId),
    );

    expect(starters).toHaveLength(ROUTINE_STARTER_TEMPLATE_IDS.length);
    expect(starters.map((template) => template?.id)).toEqual([
      "drink-water",
      "walk-distance",
      "exercise",
      "read",
      "meditate",
      "sleep",
    ]);
    expect(
      starters.every(
        (template) => template?.habitType === "boolean" || template?.habitType === "numerical",
      ),
    ).toBe(true);
    expect(starters.every((template) => template?.category)).toBe(true);
    expect(starters.some((template) => template?.habitType === "numerical")).toBe(true);
  });
});
