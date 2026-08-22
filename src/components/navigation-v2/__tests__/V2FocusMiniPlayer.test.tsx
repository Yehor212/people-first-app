import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  const originalInnerHeight = window.innerHeight;
  const originalVisualViewport = window.visualViewport;
  const originalScreenHeight = window.screen.height;

  beforeEach(() => {
    vi.clearAllMocks();
    setFocusControls(null);
    useUIStore.getState().clearFocusTimerBridge();
  });

  afterEach(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: originalVisualViewport,
    });
    Object.defineProperty(window.screen, "height", {
      configurable: true,
      value: originalScreenHeight,
    });
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

  it("does not mistake a resized split-screen window for an open keyboard", () => {
    const viewport = new EventTarget() as VisualViewport;
    Object.defineProperties(viewport, {
      height: { configurable: true, value: 600 },
      offsetTop: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.defineProperty(window.screen, "height", { configurable: true, value: 1_000 });
    useUIStore.getState().setFocusTimerBridge({
      endTime: Date.now() + 60_000,
      isRunning: true,
      isBreak: false,
      label: "Split screen",
    });

    render(<V2FocusMiniPlayer activePage="orb" onNavigateToPlanning={vi.fn()} />);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByTestId("v2-focus-mini-player")).toBeInTheDocument();
  });

  it("hides when the visual viewport reports a real IME inset", async () => {
    const viewport = new EventTarget() as VisualViewport;
    Object.defineProperties(viewport, {
      height: { configurable: true, value: 500 },
      offsetTop: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    useUIStore.getState().setFocusTimerBridge({
      endTime: Date.now() + 60_000,
      isRunning: true,
      isBreak: false,
      label: "Keyboard",
    });

    render(<V2FocusMiniPlayer activePage="orb" onNavigateToPlanning={vi.fn()} />);
    act(() => {
      viewport.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(screen.queryByTestId("v2-focus-mini-player")).not.toBeInTheDocument();
    });
  });
});
