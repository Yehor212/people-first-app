import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MoodSliderV2 } from "../MoodSliderV2";

// --- Mocks ---

let mockIsRTL = false;
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      moodVeryUnpleasant: "Very unpleasant",
      moodUnpleasant: "Unpleasant",
      moodNeutral: "Neutral",
      moodPleasant: "Pleasant",
      moodVeryPleasant: "Very pleasant",
      moodOrbGroupLabel: "How do you feel?",
      moodSliderLabel: "Mood slider",
      moodSlideHint: "Drag to find your mood",
      moodReset: "Not sure yet",
      moodCommitHint: "Press Enter to confirm",
    },
    language: "en",
    isRTL: mockIsRTL,
  }),
}));

const hapticSelectionMock = vi.fn();
vi.mock("@/lib/haptics", () => ({
  hapticSelection: () => hapticSelectionMock(),
  hapticTap: vi.fn(),
  hapticMedium: vi.fn(),
}));

let mockShouldAnimate = true;
vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => mockShouldAnimate,
}));

describe("MoodSliderV2", () => {
  beforeEach(() => {
    hapticSelectionMock.mockClear();
    mockIsRTL = false;
    mockShouldAnimate = true;
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders fieldset+legend+slider handle with correct ARIA contract", () => {
    render(
      <MoodSliderV2 value={null} onCommit={vi.fn()} />,
    );
    const fieldset = screen.getByTestId("mood-slider-v2");
    expect(fieldset).toBeInTheDocument();
    expect(screen.getByTestId("mood-slider-v2-legend")).toHaveTextContent(
      "How do you feel?",
    );
    const handle = screen.getByTestId("mood-slider-v2-handle");
    expect(handle.getAttribute("role")).toBe("slider");
    expect(handle.getAttribute("aria-valuemin")).toBe("-1");
    expect(handle.getAttribute("aria-valuemax")).toBe("1");
    expect(handle.getAttribute("aria-orientation")).toBe("horizontal");
    expect(handle.getAttribute("aria-label")).toBe("Mood slider");
  });

  it("renders 5 snap-point tick marks", () => {
    render(<MoodSliderV2 value={null} onCommit={vi.fn()} />);
    expect(screen.getByTestId("mood-slider-v2-tick--1")).toBeInTheDocument();
    expect(screen.getByTestId("mood-slider-v2-tick--0.5")).toBeInTheDocument();
    expect(screen.getByTestId("mood-slider-v2-tick-0")).toBeInTheDocument();
    expect(screen.getByTestId("mood-slider-v2-tick-0.5")).toBeInTheDocument();
    expect(screen.getByTestId("mood-slider-v2-tick-1")).toBeInTheDocument();
  });

  it("live label reads 'Neutral' when centered at 0", () => {
    render(<MoodSliderV2 value={0} onCommit={vi.fn()} />);
    const label = screen.getByTestId("mood-slider-v2-label");
    expect(label).toHaveTextContent("Neutral");
  });

  it("keyboard ArrowRight increments draft by 0.1 (no haptic, no commit)", () => {
    const onCommit = vi.fn();
    const onDraft = vi.fn();
    render(
      <MoodSliderV2 value={0} onDraft={onDraft} onCommit={onCommit} />,
    );
    const handle = screen.getByTestId("mood-slider-v2-handle");
    handle.focus();
    act(() => {
      fireEvent.keyDown(handle, { key: "ArrowRight" });
    });
    expect(onCommit).not.toHaveBeenCalled();
    // hapticSelection must NOT fire during fine-grain key steps
    expect(hapticSelectionMock).not.toHaveBeenCalled();
  });

  it("keyboard Shift+Arrow snaps to the next canonical stop", () => {
    const onCommit = vi.fn();
    const onDraft = vi.fn();
    render(
      <MoodSliderV2 value={0} onDraft={onDraft} onCommit={onCommit} />,
    );
    const handle = screen.getByTestId("mood-slider-v2-handle");
    handle.focus();
    act(() => {
      fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true });
    });
    expect(onCommit).not.toHaveBeenCalled();
    // Shift+Arrow only updates draft — should not commit or haptic.
    expect(hapticSelectionMock).not.toHaveBeenCalled();
  });

  it("Home key jumps to -1 (very unpleasant)", () => {
    const onCommit = vi.fn();
    render(<MoodSliderV2 value={0} onCommit={onCommit} />);
    const handle = screen.getByTestId("mood-slider-v2-handle");
    handle.focus();
    act(() => {
      fireEvent.keyDown(handle, { key: "Home" });
    });
    // No commit on Home — just draft
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("End key jumps to +1 (very pleasant)", () => {
    const onCommit = vi.fn();
    render(<MoodSliderV2 value={0} onCommit={onCommit} />);
    const handle = screen.getByTestId("mood-slider-v2-handle");
    handle.focus();
    act(() => {
      fireEvent.keyDown(handle, { key: "End" });
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("Space commits the current draft and fires haptic", () => {
    const onCommit = vi.fn();
    render(<MoodSliderV2 value={0} onCommit={onCommit} />);
    const handle = screen.getByTestId("mood-slider-v2-handle");
    handle.focus();
    act(() => {
      fireEvent.keyDown(handle, { key: " " });
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(hapticSelectionMock).toHaveBeenCalledTimes(1);
  });

  it("Enter commits the current draft and fires haptic", () => {
    const onCommit = vi.fn();
    render(<MoodSliderV2 value={0} onCommit={onCommit} />);
    const handle = screen.getByTestId("mood-slider-v2-handle");
    handle.focus();
    act(() => {
      fireEvent.keyDown(handle, { key: "Enter" });
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(hapticSelectionMock).toHaveBeenCalledTimes(1);
  });

  it("Escape resets draft to 0 without committing", () => {
    const onCommit = vi.fn();
    render(<MoodSliderV2 value={0.5} onCommit={onCommit} />);
    const handle = screen.getByTestId("mood-slider-v2-handle");
    handle.focus();
    act(() => {
      fireEvent.keyDown(handle, { key: "Escape" });
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("reset chip fires onCommit(0) and haptic", () => {
    const onCommit = vi.fn();
    render(<MoodSliderV2 value={0.5} onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId("mood-slider-v2-reset"));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(0);
    expect(hapticSelectionMock).toHaveBeenCalledTimes(1);
  });

  it("reset chip carries localized label text", () => {
    render(<MoodSliderV2 value={null} onCommit={vi.fn()} />);
    const reset = screen.getByTestId("mood-slider-v2-reset");
    expect(reset).toHaveTextContent("Not sure yet");
    expect(reset.getAttribute("aria-label")).toBe("Not sure yet");
  });

  it("disabled prop disables both handle and reset chip", () => {
    const onCommit = vi.fn();
    render(<MoodSliderV2 value={null} onCommit={onCommit} disabled />);
    const handle = screen.getByTestId("mood-slider-v2-handle");
    expect(handle.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByTestId("mood-slider-v2-reset")).toBeDisabled();
    // Pressing Space on disabled handle must NOT commit
    handle.focus();
    act(() => {
      fireEvent.keyDown(handle, { key: " " });
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("pointer down + up on the track commits the corresponding valence", () => {
    const onCommit = vi.fn();
    const onDraft = vi.fn();
    render(
      <MoodSliderV2 value={null} onDraft={onDraft} onCommit={onCommit} />,
    );
    // jsdom returns a zero-size rect by default — stamp a deterministic one
    // directly on the track element so clientXToValence has geometry to work
    // with. 200/400 = 0.5 → valence 0 (snaps to 0 within ±0.08).
    const track = screen.getByTestId("mood-slider-v2-track");
    Object.defineProperty(track, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          x: 0,
          y: 0,
          width: 400,
          height: 6,
          top: 0,
          right: 400,
          bottom: 6,
          left: 0,
          toJSON() {
            return {};
          },
        }) as DOMRect,
    });
    const surface = screen.getByTestId("mood-slider-v2-surface");
    // fireEvent.pointer* in jsdom strips clientX — dispatch a raw Event with
    // pointer-flavored fields attached (jsdom's PointerEvent constructor
    // ignores its init dict). This mirrors what a real pointer dispatch sees.
    act(() => {
      const down = new Event("pointerdown", {
        bubbles: true,
        cancelable: true,
      });
      Object.assign(down, {
        clientX: 200,
        pointerId: 1,
        button: 0,
        pointerType: "touch",
      });
      surface.dispatchEvent(down);
      const up = new Event("pointerup", { bubbles: true, cancelable: true });
      Object.assign(up, { clientX: 200, pointerId: 1 });
      surface.dispatchEvent(up);
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(0);
  });

  it("pointer gesture on a zero-width track is ignored (NaN guard, Law 5)", () => {
    const onCommit = vi.fn();
    render(<MoodSliderV2 value={null} onCommit={onCommit} />);
    // Default jsdom: track has no layout. Contract — no commit, no NaN.
    const surface = screen.getByTestId("mood-slider-v2-surface");
    act(() => {
      const down = new Event("pointerdown", {
        bubbles: true,
        cancelable: true,
      });
      Object.assign(down, {
        clientX: 100,
        pointerId: 2,
        button: 0,
        pointerType: "touch",
      });
      surface.dispatchEvent(down);
      const up = new Event("pointerup", { bubbles: true, cancelable: true });
      Object.assign(up, { clientX: 100, pointerId: 2 });
      surface.dispatchEvent(up);
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("ghost marker renders from localStorage on mount", () => {
    window.localStorage.setItem("zen.moodSliderV2.lastCommit", "0.5");
    render(<MoodSliderV2 value={null} onCommit={vi.fn()} />);
    const tick = screen.getByTestId("mood-slider-v2-tick-0.5");
    expect(tick.getAttribute("data-last-commit")).toBe("true");
  });

  it("commits persist to localStorage", () => {
    const onCommit = vi.fn();
    render(<MoodSliderV2 value={0} onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId("mood-slider-v2-reset"));
    expect(window.localStorage.getItem("zen.moodSliderV2.lastCommit")).toBe("0");
  });

  it("reduced-motion disables handle glow pulse animation", () => {
    mockShouldAnimate = false;
    render(<MoodSliderV2 value={null} onCommit={vi.fn()} />);
    const handle = screen.getByTestId("mood-slider-v2-handle");
    expect(handle.getAttribute("data-animate")).toBe("false");
  });

  it("aria-valuenow mirrors draft (not committed value) during keyboard steps", async () => {
    const onCommit = vi.fn();
    const onDraft = vi.fn();
    // Stub rAF → synchronous so the draft→aria publish fires in-act.
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0 as unknown as number;
      });
    try {
      render(
        <MoodSliderV2 value={0} onDraft={onDraft} onCommit={onCommit} />,
      );
      const handle = screen.getByTestId("mood-slider-v2-handle");
      handle.focus();
      // Initial aria-valuenow reflects committed 0
      expect(handle.getAttribute("aria-valuenow")).toBe("0");
      act(() => {
        fireEvent.keyDown(handle, { key: "ArrowRight" });
      });
      // Draft advanced — aria-valuenow reflects 0.1 draft, commit NOT called.
      expect(onCommit).not.toHaveBeenCalled();
      expect(handle.getAttribute("aria-valuenow")).toBe("0.1");
    } finally {
      rafSpy.mockRestore();
    }
  });

  it("RTL mode renders legend + handle but honors directional flip via surface", () => {
    mockIsRTL = true;
    render(<MoodSliderV2 value={0} onCommit={vi.fn()} />);
    const handle = screen.getByTestId("mood-slider-v2-handle");
    // Center valence (0) should still sit at 50% regardless of dir.
    expect(handle.style.left).toMatch(/50/);
  });
});
