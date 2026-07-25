import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "../EmptyState";

describe("EmptyState action reflow", () => {
  it("keeps a long localized action fully readable beside its icon", () => {
    render(
      <EmptyState
        icon={<span aria-hidden="true">•</span>}
        title="Nothing planned"
        action={{
          label: "Ajouter à l’emploi du temps",
          onClick: vi.fn(),
          icon: <svg data-testid="empty-state-action-icon" aria-hidden="true" />,
        }}
      />,
    );

    const action = screen.getByRole("button", { name: "Ajouter à l’emploi du temps" });
    const label = within(action).getByText("Ajouter à l’emploi du temps");
    const iconRail = screen.getByTestId("empty-state-action-icon").parentElement;

    expect(action).toHaveClass(
      "h-auto",
      "min-h-12",
      "min-w-0",
      "max-w-full",
      "whitespace-normal",
      "break-words",
    );
    expect(action).not.toHaveClass("whitespace-nowrap");
    expect(label).toHaveClass("min-w-0", "text-center", "[overflow-wrap:normal]");
    expect(iconRail).toHaveClass("shrink-0");
  });
});
