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
    expect(cards[0]?.querySelector('[data-slot="template-picker-symbol"]')).toHaveTextContent(
      "💧",
    );
    expect(cards[0]?.querySelector('[data-slot="template-picker-svg"]')).toBeNull();

    expect(screen.getByRole("button", { name: /create custom habit/i })).toHaveAttribute(
      "data-card",
      "ritual-custom-habit-action",
    );
  });
});
