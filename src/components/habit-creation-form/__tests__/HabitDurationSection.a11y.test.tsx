import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { en } from "@/i18n/languages/en";

import { HabitDurationSection } from "../HabitDurationSection";

const copy: Record<string, string> = {
  decrease: en.decrease,
  duration: en.duration,
  habitDurationDaysLabel: en.habitDurationDaysLabel,
  habitDurationHint: en.habitDurationHint,
  habitDurationOngoing: en.habitDurationOngoing,
  habitDurationSetDays: en.habitDurationSetDays,
  increase: en.increase,
};

describe("HabitDurationSection accessibility", () => {
  it("names the decrement and increment controls without changing their actions", () => {
    const setDurationDays = vi.fn();

    render(
      <HabitDurationSection
        isPrimaryCTA={false}
        ts={copy}
        hasDurationLimit
        setHasDurationLimit={vi.fn()}
        durationDays={7}
        setDurationDays={setDurationDays}
      />,
    );

    const decrease = screen.getByRole("button", { name: en.decrease });
    const increase = screen.getByRole("button", { name: en.increase });

    expect(screen.getByRole("spinbutton", { name: en.duration })).toHaveValue(7);

    fireEvent.click(decrease);
    fireEvent.click(increase);

    expect(setDurationDays).toHaveBeenNthCalledWith(1, 6);
    expect(setDurationDays).toHaveBeenNthCalledWith(2, 8);
  });

  it("exposes the selected duration mode without changing its action", () => {
    const setHasDurationLimit = vi.fn();

    render(
      <HabitDurationSection
        isPrimaryCTA={false}
        ts={copy}
        hasDurationLimit={false}
        setHasDurationLimit={setHasDurationLimit}
        durationDays={7}
        setDurationDays={vi.fn()}
      />,
    );

    const ongoing = screen.getByRole("button", { name: en.habitDurationOngoing });
    const setDays = screen.getByRole("button", { name: en.habitDurationSetDays });

    expect(ongoing).toHaveAttribute("aria-pressed", "true");
    expect(setDays).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(setDays);
    expect(setHasDurationLimit).toHaveBeenCalledWith(true);
  });
});
