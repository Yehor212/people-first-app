import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ROUTINE_STARTER_TEMPLATE_IDS } from "@/lib/habitTemplates";
import { TemplatePicker } from "../TemplatePicker";

describe("TemplatePicker V2 ritual presentation", () => {
  it("uses role-colored shortcut cards and a matching custom action", () => {
    const handleQuickAdd = vi.fn();
    const setShowCustomForm = vi.fn();
    const { container } = render(
      <TemplatePicker
        isPrimaryCTA
        presentation="v2"
        habits={[]}
        language="en"
        t={{
          quickAdd: "Quick add",
          createCustomHabit: "Create custom habit",
        }}
        handleQuickAdd={handleQuickAdd}
        setShowCustomForm={setShowCustomForm}
      />,
    );

    const cards = container.querySelectorAll('[data-card="ritual-template-picker-card"]');
    expect(cards).toHaveLength(ROUTINE_STARTER_TEMPLATE_IDS.length);
    expect(cards[0]).toHaveAttribute("data-visual-role", "focus");
    expect(cards[0]?.getAttribute("style")).toContain("--habit-role: var(--zf-role-focus)");
    expect(cards[0]?.querySelector('[data-slot="template-picker-symbol"]')).toBeNull();
    const pictogram = cards[0]?.querySelector(
      '[data-slot="template-picker-svg"] [data-habit-pictogram="drink-water"]',
    );
    expect(pictogram).toBeTruthy();
    expect(pictogram).toHaveAttribute("data-icon-source", "static-reduced-svg-fallback");
    expect(pictogram).toHaveAttribute("data-icon-treatment", "reduced-static-fallback");
    expect(pictogram).toHaveAttribute(
      "data-motion-system",
      "approved-lottie-static-fallback-runtime-disabled",
    );
    expect(pictogram).not.toHaveAttribute("data-approval-state");
    const iconSlot = cards[0]?.querySelector('[data-slot="template-picker-icon"]');
    expect(iconSlot).toHaveAttribute("data-icon-frame", "real-object-source-icon-native");
    expect(iconSlot?.className).toContain("h-[4.25rem]");
    expect(iconSlot?.className).toContain("w-[4.25rem]");
    expect(iconSlot?.className).toContain("overflow-visible");
    expect(iconSlot?.className).toContain("bg-transparent");
    expect(iconSlot?.className).not.toContain("rounded-[21px]");
    expect(iconSlot?.className).not.toContain("bg-[hsl(var(--card)/0.62)]");
    expect(pictogram?.className).toContain("h-[3.85rem]");
    expect(pictogram?.className).toContain("w-[3.85rem]");
    expect(cards[0]?.textContent).not.toContain("💧");

    const grid = container.querySelector('[data-slot="template-picker-grid"]');
    expect(grid).not.toBeNull();
    if (!grid) throw new Error("Expected the template picker grid");
    expect(grid.className).toContain("auto-fit");
    expect(grid.className).toContain("var(--font-scale");
    cards.forEach((card) => {
      expect(card.className).toContain("h-auto");
      expect(card.className).toContain("min-w-0");
    });

    const labels = container.querySelectorAll('[data-slot="template-picker-label"]');
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((label) => {
      expect(label.className).not.toContain("truncate");
      expect(label.className).toContain("whitespace-normal");
      expect(label.className).toContain("break-words");
      expect(label.className).toContain("overflow-wrap:break-word");
      expect(label.className).not.toContain("anywhere");
    });

    const customButton = screen.getByRole("button", { name: /create custom habit/i });
    expect(customButton).toHaveAttribute(
      "data-card",
      "ritual-custom-habit-action",
    );
    expect(customButton).toHaveClass("h-auto", "min-w-0", "whitespace-normal", "break-words");
    expect(
      customButton.querySelector('[data-slot="template-picker-custom-label"]')?.className,
    ).not.toContain("truncate");
  });

  it("marks decorative real-source habit icons as aria-hidden in the custom action", () => {
    render(
      <TemplatePicker
        isPrimaryCTA
        presentation="v2"
        habits={[]}
        language="en"
        t={{
          quickAdd: "Quick add",
          createCustomHabit: "Create custom habit",
        }}
        handleQuickAdd={vi.fn()}
        setShowCustomForm={vi.fn()}
      />,
    );

    const customButton = screen.getByRole("button", { name: /create custom habit/i });
    const decorativeIcons = customButton.querySelectorAll("svg");

    expect(decorativeIcons).toHaveLength(2);
    decorativeIcons.forEach((icon) => {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("renders secondary v2 templates with Option B liquid-glass totems", () => {
    const { container } = render(
      <TemplatePicker
        isPrimaryCTA={false}
        presentation="v2"
        habits={[]}
        language="en"
        t={{
          quickAdd: "Quick add",
          createCustomHabit: "Create custom habit",
        }}
        handleQuickAdd={vi.fn()}
        setShowCustomForm={vi.fn()}
      />,
    );

    const pictograms = container.querySelectorAll("[data-habit-pictogram]");
    expect(pictograms).toHaveLength(ROUTINE_STARTER_TEMPLATE_IDS.length);
    expect(container.querySelectorAll("[data-icon-source='approved-lottie-json']")).toHaveLength(0);
    expect(container.querySelectorAll("[data-icon-source='static-reduced-svg-fallback']")).toHaveLength(
      ROUTINE_STARTER_TEMPLATE_IDS.length,
    );
    expect(container.querySelectorAll("[data-approval-state]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-pictogram-layer]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-icon-treatment='single-lottie-icon']")).toHaveLength(0);
    expect(container.querySelectorAll("[data-icon-treatment='reduced-static-fallback']")).toHaveLength(
      ROUTINE_STARTER_TEMPLATE_IDS.length,
    );
    expect(container.querySelectorAll("[data-habit-lottie-player]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-habit-motion-still]")).toHaveLength(
      ROUTINE_STARTER_TEMPLATE_IDS.length,
    );
    expect(container.querySelectorAll("img[data-pictogram-layer='asset']")).toHaveLength(0);
    expect(container.textContent).not.toContain("💧");
    container.querySelectorAll('[data-slot="template-picker-label"]').forEach((label) => {
      expect(label.className).not.toContain("truncate");
      expect(label.className).toContain("break-words");
    });
  });
});
