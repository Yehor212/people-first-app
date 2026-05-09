import { fireEvent, render, screen } from "@testing-library/react";
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
  it("renders the live mood label as a readable orb-accent chip", () => {
    render(<ValenceSlider value={0} onChange={vi.fn()} />);

    const label = screen.getByTestId("valence-live-label");

    expect(label).toHaveTextContent(NEUTRAL_UK);
    expect(label).toHaveClass("som-valence-chip");
    expect(label.getAttribute("style")).toContain(
      `--valence-color: ${valenceToColor(0)}`,
    );
    expect(label.querySelectorAll(".som-valence-chip__orb")).toHaveLength(2);
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
});
