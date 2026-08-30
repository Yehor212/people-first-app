import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { valenceToColor } from "../colorUtils";
import { ValenceSlider } from "../ValenceSlider";

const NEUTRAL_UK = "\u041d\u0435\u0439\u0442\u0440\u0430\u043b\u044c\u043d\u043e";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      somVeryUnpleasant: "Very unpleasant",
      somUnpleasant: "Unpleasant",
      somSlightlyUnpleasant: "Slightly unpleasant",
      somNeutral: NEUTRAL_UK,
      somSlightlyPleasant: "Slightly pleasant",
      somPleasant: "Pleasant",
      somVeryPleasant: "Very pleasant",
      somSlider: "Mood slider",
    },
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { light: vi.fn(), medium: vi.fn() },
}));

describe("ValenceSlider", () => {
  it("renders the live mood label without non-canonical mini-orb dots", () => {
    render(<ValenceSlider value={0} onChange={vi.fn()} />);

    const label = screen.getByTestId("valence-live-label");

    expect(label).toHaveTextContent(NEUTRAL_UK);
    expect(label).toHaveClass("som-valence-chip");
    expect(label.getAttribute("style")).toContain(
      `--valence-color: ${valenceToColor(0)}`,
    );
    expect(label.querySelectorAll(".som-valence-chip__orb")).toHaveLength(0);
  });

  it("keeps the filtered label surface mounted while the valence label changes", () => {
    const { rerender } = render(<ValenceSlider value={0} onChange={vi.fn()} />);
    const filteredSurface = screen.getByTestId("valence-live-label");

    rerender(<ValenceSlider value={0.67} onChange={vi.fn()} />);

    expect(screen.getByTestId("valence-live-label")).toBe(filteredSurface);
    expect(filteredSurface).toHaveTextContent("Pleasant");
  });

  it("keeps enough inline padding for endpoint thumb overflow", () => {
    render(<ValenceSlider value={1} onChange={vi.fn()} />);

    const slider = screen.getByRole("slider");
    const shell = slider.parentElement;

    expect(shell).toHaveClass("px-5");
    expect(shell).not.toHaveClass("px-2");
  });

  it("positions endpoint thumb inside an inset rail instead of the slider edge", () => {
    render(<ValenceSlider value={1} onChange={vi.fn()} />);

    expect(screen.getByTestId("valence-slider-thumb-rail")).toHaveStyle({
      left: "14px",
      right: "14px",
    });
  });

  it("coalesces drag updates while keeping press and release immediate", () => {
    const rafQueue: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        rafQueue.push(callback);
        return rafQueue.length;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const onChange = vi.fn();

    try {
      render(<ValenceSlider value={0} onChange={onChange} />);
      const slider = screen.getByRole("slider");
      slider.setPointerCapture = vi.fn();
      slider.hasPointerCapture = vi.fn(() => true);
      slider.releasePointerCapture = vi.fn();
      Object.defineProperty(slider, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          left: 0,
          top: 0,
          right: 100,
          bottom: 44,
          width: 100,
          height: 44,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });

      const dispatchPointer = (type: string, clientX: number) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, {
          pointerId: { value: 1 },
          clientX: { value: clientX },
        });
        fireEvent(slider, event);
      };

      dispatchPointer("pointerdown", 0);
      dispatchPointer("pointermove", 50);
      dispatchPointer("pointermove", 100);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(-1);
      expect(rafQueue).toHaveLength(1);

      rafQueue.shift()?.(16);
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith(1);

      dispatchPointer("pointermove", 50);
      expect(rafQueue).toHaveLength(1);
      dispatchPointer("pointerup", 100);

      expect(cancelAnimationFrameSpy).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledTimes(3);
      expect(onChange).toHaveBeenLastCalledWith(1);
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it("keeps WebView pointer-capture failures non-fatal", () => {
    const onChange = vi.fn();

    render(<ValenceSlider value={0} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    slider.setPointerCapture = vi.fn(() => {
      throw new Error("capture unavailable");
    });
    slider.hasPointerCapture = vi.fn(() => true);
    slider.releasePointerCapture = vi.fn(() => {
      throw new Error("capture lost");
    });
    Object.defineProperty(slider, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 100,
        bottom: 44,
        width: 100,
        height: 44,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    const pointerDown = new Event("pointerdown", { bubbles: true, cancelable: true });
    Object.defineProperties(pointerDown, {
      pointerId: { value: 1 },
      clientX: { value: 100 },
    });
    const pointerUp = new Event("pointerup", { bubbles: true, cancelable: true });
    Object.defineProperties(pointerUp, {
      pointerId: { value: 1 },
      clientX: { value: 100 },
    });

    expect(() => fireEvent(slider, pointerDown)).not.toThrow();
    expect(() => fireEvent(slider, pointerUp)).not.toThrow();
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("uses the guarded valence calculation on zero-width pointer release", () => {
    const onChange = vi.fn();

    render(<ValenceSlider value={0} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    slider.setPointerCapture = vi.fn();
    slider.hasPointerCapture = vi.fn(() => true);
    slider.releasePointerCapture = vi.fn();
    Object.defineProperty(slider, "getBoundingClientRect", {
      configurable: true,
      value: vi
        .fn()
        .mockReturnValueOnce({
          left: 0,
          top: 0,
          right: 100,
          bottom: 44,
          width: 100,
          height: 44,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        })
        .mockReturnValue({
          left: 0,
          top: 0,
          right: 0,
          bottom: 44,
          width: 0,
          height: 44,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
    });

    const pointerDown = new Event("pointerdown", { bubbles: true, cancelable: true });
    Object.defineProperties(pointerDown, {
      pointerId: { value: 1 },
      clientX: { value: 50 },
    });
    const pointerUp = new Event("pointerup", { bubbles: true, cancelable: true });
    Object.defineProperties(pointerUp, {
      pointerId: { value: 1 },
      clientX: { value: 100 },
    });

    fireEvent(slider, pointerDown);
    fireEvent(slider, pointerUp);

    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("flushes a pending drag value on pointer cancel", () => {
    const rafQueue: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        rafQueue.push(callback);
        return rafQueue.length;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const onChange = vi.fn();

    try {
      render(<ValenceSlider value={0} onChange={onChange} />);
      const slider = screen.getByRole("slider");
      slider.setPointerCapture = vi.fn();
      slider.hasPointerCapture = vi.fn(() => true);
      slider.releasePointerCapture = vi.fn();
      Object.defineProperty(slider, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          left: 0,
          top: 0,
          right: 100,
          bottom: 44,
          width: 100,
          height: 44,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });

      const dispatchPointer = (type: string, clientX: number) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, {
          pointerId: { value: 1 },
          clientX: { value: clientX },
        });
        fireEvent(slider, event);
      };

      dispatchPointer("pointerdown", 50);
      dispatchPointer("pointermove", 100);
      expect(rafQueue).toHaveLength(1);

      dispatchPointer("pointercancel", 100);

      expect(cancelAnimationFrameSpy).toHaveBeenCalled();
      expect(onChange).toHaveBeenLastCalledWith(1);
      expect(rafQueue).toHaveLength(1);
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it("coalesces rapid keyboard updates while preserving the final snap", () => {
    vi.useFakeTimers();
    const rafQueue: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        rafQueue.push(callback);
        return rafQueue.length;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const onChange = vi.fn();

    try {
      render(<ValenceSlider value={0} onChange={onChange} />);
      const slider = screen.getByRole("slider");

      fireEvent.keyDown(slider, { key: "ArrowRight" });
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      fireEvent.keyDown(slider, { key: "ArrowLeft" });
      fireEvent.keyDown(slider, { key: "End" });

      expect(onChange).not.toHaveBeenCalled();
      expect(rafQueue).toHaveLength(1);
      expect(slider).toHaveAttribute("aria-valuenow", "3");

      act(() => {
        rafQueue.shift()?.(16);
      });
      expect(slider).toHaveAttribute("aria-valuenow", "6");

      act(() => {
        vi.advanceTimersByTime(89);
      });
      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(1);
      expect(cancelAnimationFrameSpy).not.toHaveBeenCalled();
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("flushes pending keyboard updates on blur before outside actions", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();

    try {
      render(<ValenceSlider value={0} onChange={onChange} />);
      const slider = screen.getByRole("slider");

      fireEvent.keyDown(slider, { key: "End" });
      expect(onChange).not.toHaveBeenCalled();

      fireEvent.blur(slider);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("flushes pending keyboard updates before unmount", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();

    try {
      const { unmount } = render(<ValenceSlider value={0} onChange={onChange} />);
      const slider = screen.getByRole("slider");

      fireEvent.keyDown(slider, { key: "End" });
      expect(onChange).not.toHaveBeenCalled();

      unmount();

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
