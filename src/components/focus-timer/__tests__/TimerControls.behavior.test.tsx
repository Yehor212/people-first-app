import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TimerControls } from "../TimerControls";

const labels = {
  pause: "Pause timer",
  start: "Start timer",
  resetTimer: "Reset timer",
  hyperfocusMode: "Hyperfocus mode",
};

describe("TimerControls behavior contract", () => {
  it("keeps all actions non-submitting and preserves callbacks and disabled state", () => {
    const onToggle = vi.fn();
    const onReset = vi.fn();
    const onShowHyperfocus = vi.fn();
    const { rerender } = render(
      <TimerControls
        isPrimaryCTA
        isRunning={false}
        isBreak={false}
        onToggle={onToggle}
        onReset={onReset}
        onShowHyperfocus={onShowHyperfocus}
        labels={labels}
      />,
    );

    const start = screen.getByRole("button", { name: labels.start });
    const reset = screen.getByRole("button", { name: labels.resetTimer });
    const hyperfocus = screen.getByRole("button", { name: labels.hyperfocusMode });

    expect(start).toHaveAttribute("type", "button");
    expect(reset).toHaveAttribute("type", "button");
    expect(hyperfocus).toHaveAttribute("type", "button");
    expect(hyperfocus).toBeEnabled();

    fireEvent.click(start);
    fireEvent.click(reset);
    fireEvent.click(hyperfocus);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onShowHyperfocus).toHaveBeenCalledTimes(1);

    rerender(
      <TimerControls
        isPrimaryCTA
        isRunning
        isBreak={false}
        onToggle={onToggle}
        onReset={onReset}
        onShowHyperfocus={onShowHyperfocus}
        labels={labels}
      />,
    );

    expect(screen.getByRole("button", { name: labels.pause })).toBeEnabled();
    expect(screen.getByRole("button", { name: labels.hyperfocusMode })).toBeDisabled();
  });
});
