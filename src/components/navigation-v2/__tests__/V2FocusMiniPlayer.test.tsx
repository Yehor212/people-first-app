import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { V2FocusMiniPlayer } from "../V2FocusMiniPlayer";
import { setFocusControls, useUIStore } from "@/stores";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      focus: "Focus",
      breakTime: "Break",
      pause: "Pause",
      play: "Play",
      stop: "Stop",
    },
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { light: vi.fn() },
}));

describe("V2FocusMiniPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setFocusControls(null);
    useUIStore.getState().clearFocusTimerBridge();
  });

  it("shows an active V2 focus chip outside Planning and navigates back to Planning", () => {
    const onNavigateToPlanning = vi.fn();
    useUIStore.getState().setFocusTimerBridge({
      endTime: Date.now() + 60_000,
      isRunning: true,
      isBreak: false,
      label: "Deep work",
    });

    render(<V2FocusMiniPlayer activePage="orb" onNavigateToPlanning={onNavigateToPlanning} />);

    expect(screen.getByTestId("v2-focus-mini-player")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Focus" }));
    expect(onNavigateToPlanning).toHaveBeenCalledTimes(1);
  });

  it("uses the existing focus controls for pause/play and stop", () => {
    const toggle = vi.fn();
    const reset = vi.fn();
    setFocusControls({ toggle, reset });
    useUIStore.getState().setFocusTimerBridge({
      endTime: Date.now() + 60_000,
      isRunning: true,
      isBreak: false,
      label: "Deep work",
    });

    render(<V2FocusMiniPlayer activePage="habits" onNavigateToPlanning={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("stays hidden on the Planning page", () => {
    useUIStore.getState().setFocusTimerBridge({
      endTime: Date.now() + 60_000,
      isRunning: true,
      isBreak: false,
      label: "Deep work",
    });

    render(<V2FocusMiniPlayer activePage="planning" onNavigateToPlanning={vi.fn()} />);

    expect(screen.queryByTestId("v2-focus-mini-player")).not.toBeInTheDocument();
  });
});
