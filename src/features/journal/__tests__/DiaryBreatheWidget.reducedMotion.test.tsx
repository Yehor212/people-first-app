import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ allowed: false }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      breatheIn: "Breathe in",
      hold: "Hold",
      breatheOut: "Breathe out",
      breatheGently: "Breathe gently",
      journalBreathePause: "Pause breathing",
      journalBreatheResume: "Resume breathing",
    },
  }),
}));

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: vi.fn(() => motionState.allowed),
}));

vi.mock("@/lib/haptics", () => ({
  hapticTap: vi.fn(),
}));

import { hapticTap } from "@/lib/haptics";
import { DiaryBreatheWidget } from "../DiaryBreatheWidget";

describe("DiaryBreatheWidget reduced motion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    motionState.allowed = false;
    vi.mocked(hapticTap).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a neutral static cue without requesting haptics when motion is disabled", () => {
    render(<DiaryBreatheWidget />);

    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(hapticTap).not.toHaveBeenCalled();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Breathe gently");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByText("Breathe in")).not.toBeInTheDocument();
  });

  it("lets the user pause and resume an otherwise continuous breathing cycle", () => {
    motionState.allowed = true;
    render(<DiaryBreatheWidget />);

    expect(screen.getByRole("button", { name: "Pause breathing" })).toBeInTheDocument();
    expect(screen.getByText("Breathe in")).not.toHaveAttribute("aria-live", "polite");

    fireEvent.click(screen.getByRole("button", { name: "Pause breathing" }));
    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(screen.getByRole("button", { name: "Resume breathing" })).toBeInTheDocument();
    expect(screen.getByText("Breathe gently")).toBeInTheDocument();
    expect(hapticTap).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Resume breathing" }));
    act(() => {
      vi.advanceTimersByTime(3_600);
    });

    expect(screen.getByRole("button", { name: "Pause breathing" })).toBeInTheDocument();
    expect(hapticTap).toHaveBeenCalledTimes(1);
  });

  it("resumes from the paused point instead of restarting the breathing cycle", () => {
    motionState.allowed = true;
    render(<DiaryBreatheWidget />);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Pause breathing" }));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(hapticTap).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Resume breathing" }));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(hapticTap).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText("Hold")).toBeInTheDocument();
    expect(hapticTap).toHaveBeenCalledTimes(1);
  });

  it("waits for explicit user intent when embedded in a panic-lock surface", () => {
    motionState.allowed = true;
    render(<DiaryBreatheWidget initiallyPaused />);

    act(() => {
      vi.advanceTimersByTime(8_000);
    });
    expect(screen.getByText("Breathe gently")).toBeInTheDocument();
    expect(hapticTap).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Resume breathing" }));
    act(() => {
      vi.advanceTimersByTime(3_600);
    });

    expect(screen.getByText("Hold")).toBeInTheDocument();
    expect(hapticTap).toHaveBeenCalledTimes(1);
  });
});
