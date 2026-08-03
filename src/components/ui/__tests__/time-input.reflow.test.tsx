import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TimeInput, TimeInputInline } from "@/components/ui/time-input";

describe("TimeInputInline text reflow", () => {
  it("stacks at narrow widths and keeps the complete localized label", () => {
    render(
      <TimeInputInline
        label="Нагадування про зосереджену роботу"
        value="10:00"
        onChange={() => undefined}
      />
    );

    const input = screen.getByLabelText("Нагадування про зосереджену роботу");
    const label = screen.getByText("Нагадування про зосереджену роботу");
    const root = input.closest("[data-time-input-inline]");
    const inputWrapper = input.parentElement;

    expect(root).toHaveClass("grid", "grid-cols-1", "sm:grid-cols-[minmax(0,1fr)_auto]");
    expect(root?.className).not.toContain("min-[420px]:grid-cols");
    expect(label).not.toHaveClass("truncate");
    expect(label).toHaveClass(
      "min-w-0",
      "break-words",
      "[hyphens:auto]",
      "[overflow-wrap:break-word]",
    );
    expect(label.className).not.toContain("[hyphens:manual]");
    expect(label.className).not.toContain("[overflow-wrap:anywhere]");
    expect(inputWrapper).toHaveClass("w-full", "min-w-0", "sm:w-auto");
    expect(input).toHaveClass("h-12", "min-h-[48px]", "w-full", "sm:w-28");
    expect(input).not.toHaveClass("h-11", "min-h-[44px]");
  });

  it("keeps the shared time field at least 48px tall", () => {
    render(
      <TimeInput
        aria-label="Reminder time"
        value="10:00"
        onChange={() => undefined}
      />
    );

    expect(screen.getByLabelText("Reminder time")).toHaveClass("h-12", "min-h-[48px]");
  });
});
