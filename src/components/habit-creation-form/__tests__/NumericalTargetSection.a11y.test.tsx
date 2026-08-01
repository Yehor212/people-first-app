import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { en } from "@/i18n/languages/en";

import { NumericalTargetSection } from "../NumericalTargetSection";

const copy: Record<string, string> = {
  atLeast: en.atLeast,
  atMost: en.atMost,
  decreaseTarget: en.decreaseTarget,
  habitTarget: en.habitTarget,
  habitUnit: en.habitUnit,
  increaseTarget: en.increaseTarget,
};

describe("NumericalTargetSection accessibility", () => {
  it("names the decrement, increment, target, and unit controls without changing their actions", () => {
    const setTargetValue = vi.fn();

    render(
      <NumericalTargetSection
        isPrimaryCTA={false}
        ts={copy}
        targetValue={3}
        targetStep={1}
        setTargetValue={setTargetValue}
        targetType="atLeast"
        setTargetType={vi.fn()}
        quickEntryMode="completeTarget"
        setQuickEntryMode={vi.fn()}
        unit="pages"
        setUnit={vi.fn()}
      />,
    );

    const decrease = screen.getByRole("button", { name: en.decreaseTarget });
    const increase = screen.getByRole("button", { name: en.increaseTarget });

    expect(screen.getByRole("spinbutton", { name: en.habitTarget })).toHaveValue(3);
    expect(screen.getByRole("textbox", { name: en.habitUnit })).toHaveValue("pages");

    fireEvent.click(decrease);
    fireEvent.click(increase);

    expect(setTargetValue).toHaveBeenNthCalledWith(1, 2);
    expect(setTargetValue).toHaveBeenNthCalledWith(2, 4);
  });

  it("exposes the selected target rule without changing its action", () => {
    const setTargetType = vi.fn();

    render(
      <NumericalTargetSection
        isPrimaryCTA={false}
        ts={copy}
        targetValue={3}
        targetStep={1}
        setTargetValue={vi.fn()}
        targetType="atLeast"
        setTargetType={setTargetType}
        quickEntryMode="completeTarget"
        setQuickEntryMode={vi.fn()}
        unit="pages"
        setUnit={vi.fn()}
      />,
    );

    const atLeast = screen.getByRole("button", { name: en.atLeast });
    const atMost = screen.getByRole("button", { name: en.atMost });

    expect(atLeast).toHaveAttribute("aria-pressed", "true");
    expect(atMost).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(atMost);
    expect(setTargetType).toHaveBeenCalledWith("atMost");
  });
});
